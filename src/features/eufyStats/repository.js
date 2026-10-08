const path = require('path');
const Database = require('better-sqlite3');
const paths = require('../../config/paths');

// 個人情報・ID類(device_id/user_id/customer_id/group_id/eufy側のレコードid)は含めない。
// 体重に関するデータの推移閲覧サイト(別プロジェクト)から直接参照される想定なので、
// weightは呼び出し側で単位変換済み(kg)のものを渡してもらう。
const db = new Database(path.join(paths.dataDir, 'eufy_weight.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS weight_measurements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    measured_at INTEGER NOT NULL UNIQUE, -- eufy側のcreate_time(unix秒)。測定日時
    updated_at INTEGER,                  -- eufy側のupdate_time(unix秒)
    recorded_at INTEGER NOT NULL,        -- Botがこの行をINSERTしたunixミリ秒
    status INTEGER,
    product_code TEXT,
    mode INTEGER,
    weight_kg REAL,
    standard_weight REAL,
    water_weight REAL,
    bmi REAL,
    body_fat REAL,
    subcutaneous_fat_rate REAL,
    visceral_fat_index REAL,
    muscle REAL,
    muscle_mass REAL,
    skeletal_muscle_mass REAL,
    bmr INTEGER,
    bone REAL,
    bone_mass REAL,
    water REAL,
    body_age INTEGER,
    protein_ratio REAL,
    impedance INTEGER,
    visceral_fat INTEGER,
    fat_free_weight REAL,
    body_fat_mass REAL,
    fat_mode INTEGER,
    heart_rate INTEGER,
    body_type INTEGER,
    head_size REAL,
    height REAL
  );

  CREATE INDEX IF NOT EXISTS idx_weight_measurements_measured_at ON weight_measurements(measured_at);
`);

const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO weight_measurements (
    measured_at, updated_at, recorded_at, status, product_code, mode,
    weight_kg, standard_weight, water_weight, bmi, body_fat, subcutaneous_fat_rate,
    visceral_fat_index, muscle, muscle_mass, skeletal_muscle_mass, bmr, bone, bone_mass,
    water, body_age, protein_ratio, impedance, visceral_fat, fat_free_weight,
    body_fat_mass, fat_mode, heart_rate, body_type, head_size, height
  ) VALUES (
    @measured_at, @updated_at, @recorded_at, @status, @product_code, @mode,
    @weight_kg, @standard_weight, @water_weight, @bmi, @body_fat, @subcutaneous_fat_rate,
    @visceral_fat_index, @muscle, @muscle_mass, @skeletal_muscle_mass, @bmr, @bone, @bone_mass,
    @water, @body_age, @protein_ratio, @impedance, @visceral_fat, @fat_free_weight,
    @body_fat_mass, @fat_mode, @heart_rate, @body_type, @head_size, @height
  )
`);

// measurement: eufy APIの生レコード({ create_time, update_time, status, product_code, scale_data })
function toRow(measurement) {
  const d = measurement.scale_data;
  return {
    measured_at: measurement.create_time,
    updated_at: measurement.update_time ?? null,
    recorded_at: Date.now(),
    status: measurement.status ?? null,
    product_code: measurement.product_code ?? null,
    mode: d.mode,
    weight_kg: d.weight / 10,
    standard_weight: d.standard_weight,
    water_weight: d.water_weight,
    bmi: d.bmi,
    body_fat: d.body_fat,
    subcutaneous_fat_rate: d.subcutaneous_fat_rate,
    visceral_fat_index: d.visceral_fat_index,
    muscle: d.muscle,
    muscle_mass: d.muscle_mass,
    skeletal_muscle_mass: d.skeletal_muscle_mass,
    bmr: d.bmr,
    bone: d.bone,
    bone_mass: d.bone_mass,
    water: d.water,
    body_age: d.body_age,
    protein_ratio: d.protein_ratio,
    impedance: d.impedance,
    visceral_fat: d.visceral_fat,
    fat_free_weight: d.fat_free_weight,
    body_fat_mass: d.body_fat_mass,
    fat_mode: d.fat_mode,
    heart_rate: d.heart_rate,
    body_type: d.body_type,
    head_size: d.head_size,
    height: d.height,
  };
}

// measured_atが既存なら無視するため、同じ測定を何度渡しても重複しない
function insertMeasurements(measurements) {
  const insertMany = db.transaction((rows) => {
    for (const row of rows) insertStmt.run(row);
  });
  insertMany(measurements.map(toRow));
}

module.exports = { insertMeasurements };
