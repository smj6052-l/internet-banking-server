const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt'); // sha256 사용할 예정이라 사용안해도 됨 임시로 적용.
const dotenv = require('dotenv');
const { body, param, validationResult } = require('express-validator');

dotenv.config();

// 데이터베이스 연결 설정
const dbConfig = {
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DB,
};

// 계좌 번호 생성 함수 (33??-??-??????) 형식
async function generateAccountNumber(connection) {
    let account_number;
    let isUnique = false;
  
    while (!isUnique) {
      const part1 = `33${Math.floor(10 + Math.random() * 90)}`;
      const part2 = Math.floor(10 + Math.random() * 90);
      const part3 = Math.floor(100000 + Math.random() * 900000);
      account_number = `${part1}-${part2}-${part3}`;
  
      const [existingAccount] = await connection.execute('SELECT 1 FROM Account WHERE account_number = ?', [account_number]);
      if (existingAccount.length === 0) {
        isUnique = true;
      }
    }
  
    return account_number;
  }

// 계좌 생성 폼 표시
router.get('/enter', (req, res) => {
  res.render('account_enter');
});

// 새 계좌 생성
router.post('/enter', [
//   body('account_name').trim().notEmpty().withMessage('계좌 이름을 입력해주세요.'), 
//   body('account_type').trim().isIn(['savings', 'checking']).withMessage('유효하지 않은 계좌 유형입니다.'),
//   body('account_pw').isLength({ min: 6 }).withMessage('비밀번호는 최소 6자리이어야 합니다.'),
//   body('day_transfer_limit').isInt({ min: 0 }).withMessage('유효하지 않은 이체 한도입니다.'),
//   body('login_pw').notEmpty().withMessage('로그인 비밀번호를 입력해주세요.'),
], async (req, res) => {
  console.log('받아 온 데이터:', req.body);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { account_name, account_type, account_pw, day_transfer_limit, login_pw, status } = req.body;
  const account_balance = 0;
  const account_reg_date = new Date();
  let account_number;

  //const client_pk = req.session.user.client_pk;
  // 임시로 고정된 client_pk 사용 (실제 구현 시 제대로 가져와야 함)
  const client_pk = 1;

  try {
    const connection = await mysql.createConnection(dbConfig);

    // 계좌 번호 생성
    account_number = await generateAccountNumber(connection);

    // 사용자의 로그인 비밀번호 조회
    const [userRows] = await connection.execute('SELECT client_pw FROM Client WHERE client_pk = ?', [client_pk]);
    
    if (userRows.length === 0) {
      await connection.end();
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    // 입력된 로그인 비밀번호와 입력된 비밀번호 비교
    // const isPasswordValid = await bcrypt.compare(login_pw, userRows[0].client_pw);
    // if (!isPasswordValid) {
    //   await connection.end();
    //   return res.status(401).json({ error: '로그인 비밀번호가 유효하지 않습니다.' });
    // }

    // 새 계좌 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(account_pw, 10);

    await connection.beginTransaction();

    // 새 계좌 데이터 삽입
    const [result] = await connection.execute(
        'INSERT INTO Account (client_pk, account_number, account_name, account_type, account_balance, account_pw, account_reg_date, day_transfer_limit, account_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [client_pk, account_number, account_name, account_type, account_balance, hashedPassword, account_reg_date, day_transfer_limit, status]
    );
    
     console.log('새 계좌 생성됨:', { account_number, account_name, account_type, account_balance, day_transfer_limit, status });

     if (account_type === 'group') {
        await connection.execute(
          'INSERT INTO `Group` (account_pk, group_name) VALUES (?, ?)',
          [result.insertId, account_name]
        );
  
        // GroupAccountMember 테이블에 소유자 추가
        await connection.execute(
          'INSERT INTO GroupAccountMember (group_pk, account_pk, client_pk, member_role) VALUES ((SELECT group_pk FROM `Group` WHERE account_pk = ?), ?, ?, ?)',
          [result.insertId, result.insertId, client_pk, 'owner']
        );
      }
    // 생성된 계좌 정보 조회
    const [newAccount] = await connection.execute('SELECT account_pk, client_pk, account_number, account_name, account_type, account_balance, account_reg_date, day_transfer_limit, account_status FROM Account WHERE account_pk = ?', [result.insertId]);

    await connection.commit();
    await connection.end();

    res.status(201).json({ account: newAccount[0] });
  } catch (error) {
    console.error('계좌 생성 오류:', error);
    res.status(500).json({ error: '내부 서버 오류' });
  }
});

// 로그인된 사용자의 계좌 목록
router.get('/', async (req, res) => {
    // const client_pk = req.session.user.client_pk;
    const client_pk = req.query.client_pk;
    try {
      const connection = await mysql.createConnection(dbConfig);
      const [rows] = await connection.execute('SELECT account_name, account_balance, account_number FROM Account WHERE client_pk = ?', [client_pk]);
      // 조회 목록: 계좌 별칭, 잔액 , 계좌 번호
      const [user] = await connection.execute('SELECT client_name FROM Client WHERE client_pk = ?', [client_pk]); // 사용자 이름 조회
      await connection.end();
      res.json({ client: user[0], accounts: rows });
    } catch (error) {
      console.error('계좌 조회 오류:', error);
      res.status(500).json({ error: '내부 서버 오류' });
    }
  });

// 로그인된 사용자의 특정 계좌 정보 조회
router.get('/:accountId', [
    param('accountId').isInt().withMessage('유효하지 않은 계좌 ID입니다')
  ], async (req, res) => {
    const { accountId } = req.params;
    const client_pk = req.session.user.client_pk;
  
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
  
    try {
      const connection = await mysql.createConnection(dbConfig);
      const [rows] = await connection.execute('SELECT account_name, account_balance, account_number FROM Account WHERE account_pk = ? AND client_pk = ?', [accountId, client_pk]);
      // 조회 목록: 계좌 별칭, 잔액 , 계좌 번호
      await connection.end();
  
      if (rows.length === 0) {
        return res.status(404).json({ error: '계좌를 찾을 수 없습니다' });
      }
      res.json({ account: rows[0] });
    } catch (error) {
      console.error('계좌 조회 오류:', error);
      res.status(500).json({ error: '내부 서버 오류' });
    }
  });

module.exports = router;
