const eufyClient = require('./eufyClient');
const { buildEmbed, formatMeasurement } = require('./embed');
const messageStore = require('./messageStore');
const measurementStore = require('./measurementStore');
const repository = require('./repository');
const targets = require('../../config/targets');
const logger = require('../../infra/logger');

const UPDATE_EMOJI = '🔄';

// 保存済みの前回同期結果(measurementStore)を基準に after=<create_time> で差分だけ取得する。
// - toInsert: sqliteに保存する全件(初回のみ履歴全件、以降は新規差分全件)
// - toSend: Discordにメッセージとして送る分(古い順)。初回は履歴を溜め込んで複数通送らないよう最新1件のみ
// - baselinePrevious: toSendの先頭の差分計算に使う「その前の測定」
async function fetchNewMeasurements() {
  const cache = measurementStore.load();

  if (!cache?.current) {
    const all = await eufyClient.getMeasurements();
    if (all.length === 0) return { toInsert: [], toSend: [], baselinePrevious: null };
    return { toInsert: all, toSend: [all[0]], baselinePrevious: all[1] || null };
  }

  // eufy API側のafterは「その時刻以降(境界含む)」を返すことがあるため、
  // 前回送信済みのcreate_time以下のレコードは確実に除外する(これが無いと更新が無い時も再送信してしまう)
  const fetched = await eufyClient.getMeasurements(cache.current.create_time);
  const newer = fetched.filter((m) => m.create_time > cache.current.create_time);
  return { toInsert: newer, toSend: [...newer].reverse(), baselinePrevious: cache.current };
}

// 🔄ボタンを常にどこかに置いておくための初期化。既存メッセージがあれば何もしない
async function ensurePlaceholder(channel) {
  const existingId = messageStore.getMessageId();
  if (existingId) {
    try {
      await channel.messages.fetch(existingId);
      return;
    } catch (err) {
      logger.warn('[eufyStats] 保存済みメッセージが取得できないため新規作成します', err);
    }
  }

  const message = await channel.send({ content: '🔄を押すとeufyの最新データを取得します' });
  messageStore.setMessageId(message.id);
  await message.react(UPDATE_EMOJI);
}

// 新しく送ったメッセージに🔄を移し、それまで付いていたメッセージからは外す
async function moveReaction(channel, newMessage) {
  const oldMessageId = messageStore.getMessageId();

  await newMessage
    .react(UPDATE_EMOJI)
    .catch((err) => logger.error('[eufyStats] 新しいメッセージへのリアクション付与に失敗しました', err));
  messageStore.setMessageId(newMessage.id);

  if (!oldMessageId || oldMessageId === newMessage.id) return;
  try {
    const oldMessage = await channel.messages.fetch(oldMessageId);
    const reaction = oldMessage.reactions.cache.get(UPDATE_EMOJI);
    if (reaction) await reaction.users.remove(channel.client.user.id);
  } catch (err) {
    logger.error('[eufyStats] 古いメッセージの🔄削除に失敗しました', err);
  }
}

async function runSync(client) {
  const { guildId, channelId } = targets.eufyStats;
  if (!guildId || !channelId) {
    logger.warn('[eufyStats] targets.eufyStats.guildId/channelId が未設定のためスキップします');
    return;
  }

  const { toInsert, toSend, baselinePrevious } = await fetchNewMeasurements();
  if (toSend.length === 0) {
    logger.info('[eufyStats] 新しい測定はありません');
    return;
  }

  repository.insertMeasurements(toInsert);

  const guild = client.guilds.cache.get(guildId);
  const channel = client.channels.cache.get(channelId);
  if (!guild || !channel) {
    logger.error('[eufyStats] 対象のguildまたはchannelが見つかりません');
    return;
  }

  let previous = baselinePrevious;
  let lastSentMessage = null;
  for (const measurement of toSend) {
    lastSentMessage = await channel.send({ embeds: [buildEmbed(measurement, previous)] });
    previous = measurement;
  }

  await moveReaction(channel, lastSentMessage);

  const latest = toSend[toSend.length - 1];
  const secondLatest = toSend.length > 1 ? toSend[toSend.length - 2] : baselinePrevious;
  measurementStore.save({ current: latest, previous: secondLatest });

  const { weightKg } = formatMeasurement(latest);
  try {
    const owner = await guild.members.fetch(targets.botOwnerUserId);
    await owner.setNickname(`${weightKg.toFixed(1)}`);
  } catch (err) {
    logger.error('[eufyStats] ownerのニックネーム変更に失敗しました(権限/ロール階層/サーバーオーナーでないか確認してください)', err);
  }

  logger.info(
    `[eufyStats] 同期完了 (${toSend.length}件追加, 最新: ${weightKg.toFixed(1)}kg, 測定日時: ${new Date(latest.create_time * 1000).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })})`
  );
}

module.exports = { runSync, ensurePlaceholder, UPDATE_EMOJI };
