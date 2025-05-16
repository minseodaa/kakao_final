const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const resultsDir = path.join(__dirname, 'results');
const dbPath = path.join(__dirname, 'bank.db');

// 1. DB 연결
const db = new sqlite3.Database(dbPath);

// 2. 테이블 생성
// amount는 정수형으로 저장
// bank, account_number, name은 문자열
// id는 자동 증가

// 테이블 생성
// 이미 있으면 무시

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS bank (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bank TEXT,
      account_number TEXT,
      name TEXT,
      amount INTEGER
    )
  `);

  // 3. results 폴더의 모든 json 파일 읽기
  const files = fs.readdirSync(resultsDir).filter(f => f.endsWith('.json'));
  files.forEach(file => {
    const content = fs.readFileSync(path.join(resultsDir, file), 'utf8');
    let json;
    try {
      json = JSON.parse(content);
    } catch (e) {
      console.error(`${file} 파싱 실패`);
      return;
    }

    // 4. Left만 추출 (json이 배열일 수도 있고, 객체일 수도 있음)
    let left = null;
    if (Array.isArray(json)) {
      // 배열이면 각 객체에서 left만 추출
      json.forEach(obj => {
        if (obj.Left) left = obj.Left;
      });
    } else if (json.Left) {
      left = json.Left;
    }

    if (left) {
      db.run(
        `INSERT INTO bank (bank, account_number, name, amount) VALUES (?, ?, ?, ?)`,
        [left.bank, left.account_number, left.name, parseInt(left.amount, 10) || 0],
        function (err) {
          if (err) {
            console.error(`${file} DB 저장 실패:`, err.message);
          } else {
            console.log(`${file} -> DB 저장 성공 (id: ${this.lastID})`);
          }
        }
      );
    } else {
      console.log(`${file} : Left 데이터 없음`);
    }
  });
});

// 5. DB 닫기 (약간의 지연 후)
setTimeout(() => db.close(), 2000); 