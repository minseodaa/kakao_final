const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const port = 5000;

// 미들웨어 설정
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

const resultsDir = path.join(__dirname, 'results');
const dbPath = path.join(__dirname, 'bank.db');

// 결과를 저장할 디렉토리 생성
if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir);
}

// DB 테이블 생성(최초 1회)
function ensureTable() {
  const db = new sqlite3.Database(dbPath);
  db.run(`
    CREATE TABLE IF NOT EXISTS bank (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bank TEXT,
      account_number TEXT,
      name TEXT,
      amount INTEGER
    )
  `, () => db.close());
}
ensureTable();

// 분석 결과를 저장하는 엔드포인트
app.post('/save-analysis', (req, res) => {
    try {
        let { response } = req.body;
        if (!response) throw new Error('응답 데이터가 없습니다');

        // 여러 개의 JSON 객체가 붙어 있을 때 모두 추출
        const matches = response.match(/\{[\s\S]*?\}/g);

        let result;
        if (matches && matches.length > 1) {
            // 여러 개면 배열로 감싸서 파싱
            result = matches.map(str => JSON.parse(str));
        } else if (matches && matches.length === 1) {
            // 하나면 그대로 파싱
            result = JSON.parse(matches[0]);
        } else {
            throw new Error('JSON 형식의 데이터가 응답에 없습니다');
        }

        // 파일 저장
        const filename = `analysis_${Date.now()}.json`;
        const filepath = path.join(resultsDir, filename);
        fs.writeFileSync(filepath, JSON.stringify(result, null, 2));

        res.json({ success: true, message: '분석 결과가 저장되었습니다.', filename });
    } catch (error) {
        console.error('저장 중 오류 발생:', error);
        res.status(500).json({ success: false, message: '저장 중 오류가 발생했습니다.', error: error.message });
    }
});

// 저장된 결과 목록을 가져오는 엔드포인트
app.get('/get-analyses', (req, res) => {
    try {
        const files = fs.readdirSync(resultsDir);
        const analyses = files
            .filter(file => file.endsWith('.json'))
            .map(file => {
                const content = fs.readFileSync(path.join(resultsDir, file), 'utf8');
                return JSON.parse(content);
            });

        res.json({ success: true, analyses });
    } catch (error) {
        console.error('결과 조회 중 오류 발생:', error);
        res.status(500).json({ 
            success: false, 
            message: '결과 조회 중 오류가 발생했습니다.',
            error: error.message 
        });
    }
});

// results 폴더의 새 파일을 감시해서 bank.db에 Left 데이터 자동 저장
function saveJsonToDb(filePath) {
  fs.readFile(filePath, 'utf8', (err, content) => {
    if (err) return;
    let json;
    try {
      json = JSON.parse(content);
    } catch (e) {
      console.error(`${filePath} 파싱 실패`);
      return;
    }
    let left = null;
    if (Array.isArray(json)) {
      json.forEach(obj => { if (obj.Left) left = obj.Left; });
    } else if (json.Left) {
      left = json.Left;
    }
    if (left) {
      const db = new sqlite3.Database(dbPath);
      db.run(
        `INSERT INTO bank (bank, account_number, name, amount) VALUES (?, ?, ?, ?)` ,
        [left.bank, left.account_number, left.name, parseInt(left.amount, 10) || 0],
        function (err) {
          if (err) {
            console.error(`${filePath} DB 저장 실패:`, err.message);
          } else {
            console.log(`${filePath} -> DB 저장 성공 (id: ${this.lastID})`);
          }
          db.close();
        }
      );
    }
  });
}

fs.watch(resultsDir, (eventType, filename) => {
  if (filename && filename.endsWith('.json') && eventType === 'rename') {
    const filePath = path.join(resultsDir, filename);
    fs.access(filePath, fs.constants.F_OK, (err) => {
      if (!err) {
        saveJsonToDb(filePath);
      }
    });
  }
});

app.listen(port, () => {
    console.log(`서버가 http://localhost:${port} 에서 실행 중입니다.`);
}); 