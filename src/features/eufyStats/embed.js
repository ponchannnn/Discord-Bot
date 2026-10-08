const { EmbedBuilder } = require('discord.js');

// フィールド定義はeufyApiReference.md 6章参照
function formatMeasurement(measurement) {
  const d = measurement.scale_data;
  return {
    weightKg: d.weight / 10,
    bmi: d.bmi,
    bodyFat: d.body_fat,
    muscleMass: d.muscle_mass,
    boneMass: d.bone_mass,
    water: d.water,
    bmr: d.bmr,
    visceralFat: d.visceral_fat,
    proteinRatio: d.protein_ratio,
    heartRate: d.heart_rate,
    measuredAt: new Date(measurement.create_time * 1000),
  };
}

// 前回値が無い/0(体重のみの測定で体組成が0になっている場合)は差分を出さない
function diffText(current, previous, digits) {
  if (!previous || !current) return '';
  const diff = Math.round((current - previous) * 10 ** digits) / 10 ** digits;
  if (diff === 0) return '\n± 0';
  return `\n${diff > 0 ? '▲ +' : '▼ '}${diff.toFixed(digits)}`;
}

function buildEmbed(measurement, previousMeasurement) {
  const cur = formatMeasurement(measurement);
  const prev = previousMeasurement ? formatMeasurement(previousMeasurement) : null;

  const field = (name, key, unit, digits) => ({
    name,
    value: `${cur[key].toFixed(digits)}${unit}${diffText(cur[key], prev?.[key], digits)}`,
    inline: true,
  });

  const embed = new EmbedBuilder()
    .setTitle('体組成データ')
    .setColor(0x00aaff)
    .setTimestamp(cur.measuredAt)
    .setFooter({ text: 'eufy Life (🔄で最新データを取得 / 差分は前回測定比)' })
    .addFields(
      field('体重', 'weightKg', ' kg', 1),
      field('BMI', 'bmi', '', 1),
      field('体脂肪率', 'bodyFat', '%', 1),
      field('筋肉量', 'muscleMass', ' kg', 1),
      field('骨量', 'boneMass', ' kg', 1),
      field('水分率', 'water', '%', 1),
      field('基礎代謝量', 'bmr', ' kcal', 0),
      field('内臓脂肪レベル', 'visceralFat', '', 0),
      field('タンパク質率', 'proteinRatio', '%', 1)
    );

  if (cur.heartRate > 0) {
    embed.addFields({ name: '心拍数', value: `${cur.heartRate} bpm`, inline: true });
  }

  return embed;
}

module.exports = { buildEmbed, formatMeasurement };
