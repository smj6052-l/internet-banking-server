const express = require('express');
const router = express.Router();
const schedule = require('node-schedule');
const mysql = require('mysql2/promise');

// 사용자가 속한 모임통장 목록
router.get('/', async (req, res) => {
    const clientPk = req.session.client.client_pk;
    const mysqldb = req.app.get('mysqldb');

    try {
        const rows = await new Promise((resolve, reject) => {
            mysqldb.query(
                `SELECT g.group_pk, g.group_name, a.account_number, a.account_balance, gam.member_role
                 FROM \`Group\` g
                 JOIN GroupAccountMember gam ON g.group_pk = gam.group_pk
                 JOIN Account a ON g.account_pk = a.account_pk
                 WHERE gam.client_pk = ? AND gam.invite_status = 'accepted'
                 ORDER BY g.group_created_date DESC`,
                [clientPk],
                (error, results) => {
                    if (error) reject(error);
                    else resolve(results);
                }
            );
        });

        res.json({ groupAccounts: rows });

    } catch (error) {
        console.error('모임통장 목록 조회 오류:', error);
        res.status(500).json({ error: '내부 서버 오류' });
    }
});

//특정 모임통장 조회하기
router.get('/:groupPk', async (req, res) => {
    const { groupPk } = req.params;
    const clientPk = req.session.client.client_pk;
    const mysqldb = req.app.get('mysqldb');

    try {
        // 사용자가 해당 모임통장의 멤버인지 확인
        const [memberCheck] = await mysqldb.promise().query(
            'SELECT * FROM GroupAccountMember WHERE group_pk = ? AND client_pk = ? AND invite_status = "accepted"',
            [groupPk, clientPk]
        );

        if (memberCheck.length === 0) {
            return res.status(403).json({ error: '해당 모임통장에 대한 접근 권한이 없습니다.' });
        }

        // 모임통장 정보 조회
        const [groupInfo] = await mysqldb.promise().query(
            `SELECT g.group_name, g.group_description, 
                    a.account_number, a.account_balance, a.account_pk,
                    g.auto_deposit_day, g.auto_deposit_amount, g.target_amount
             FROM \`Group\` g
             JOIN Account a ON g.account_pk = a.account_pk
             WHERE g.group_pk = ?`,
            [groupPk]
        );

        if (groupInfo.length === 0) {
            return res.status(404).json({ error: '모임통장을 찾을 수 없습니다.' });
        }

        // 모임통장 멤버 목록 조회
        const [members] = await mysqldb.promise().query(
            `SELECT c.client_name, gam.member_role, gam.member_join_date
             FROM GroupAccountMember gam
             JOIN Client c ON gam.client_pk = c.client_pk
             WHERE gam.group_pk = ? AND gam.invite_status = 'accepted'
             ORDER BY gam.member_join_date`,
            [groupPk]
        );

        // 모임통장 거래 내역 조회 (최근 10개)
        const [transactions] = await mysqldb.promise().query(
            `SELECT th.transaction_pk, th.transaction_name, th.transaction_type, 
                    th.transaction_amount, th.transaction_balance, th.transaction_date, 
                    th.transaction_memo
             FROM TransactionHistory th
             WHERE th.transaction_origin = ? OR th.transaction_destination = ?
             ORDER BY th.transaction_date DESC
             LIMIT 10`,
            [groupInfo[0].account_pk, groupInfo[0].account_pk]
        );

        const response = {
            groupInfo: groupInfo[0],
            members: members,
            transactions: transactions
        };

        res.json(response);

    } catch (error) {
        console.error('모임통장 정보 조회 오류:', error);
        res.status(500).json({ error: '내부 서버 오류' });
    }
});


// 모임통장 설정 업데이트
router.post('/update-settings', async (req, res) => {
    const { group_pk, auto_deposit_day, auto_deposit_amount, target_amount } = req.body;
    const client_pk = req.session.client.client_pk;
    const mysqldb = req.app.get('mysqldb');

    try {
        // 사용자가 그룹의 owner인지 확인
        const [owner] = await mysqldb.promise().execute(
            'SELECT * FROM GroupAccountMember WHERE group_pk = ? AND client_pk = ? AND member_role = "owner"',
            [group_pk, client_pk]
        );

        if (owner.length === 0) {
            return res.status(403).json({ error: '모임통장 설정을 변경할 권한이 없습니다.' });
        }

        // 그룹 설정 업데이트
        await mysqldb.promise().execute(
            'UPDATE `Group` SET auto_deposit_day = ?, auto_deposit_amount = ?, target_amount = ? WHERE group_pk = ?',
            [auto_deposit_day, auto_deposit_amount, target_amount, group_pk]
        );

        res.json({ success: true, message: '모임통장 설정이 성공적으로 업데이트되었습니다.' });
    } catch (error) {
        console.error('모임통장 설정 업데이트 오류:', error);
        res.status(500).json({ error: '내부 서버 오류' });
    }
});

router.post('/update-auto-deposit', async (req, res) => {
    const { group_pk, auto_deposit_account_pk } = req.body;
    const client_pk = req.session.client.client_pk;
    const mysqldb = req.app.get('mysqldb');

    try {
        // 사용자가 그룹의 멤버인지 확인
        const [member] = await mysqldb.promise().execute(
            'SELECT * FROM GroupAccountMember WHERE group_pk = ? AND client_pk = ? AND invite_status = "accepted"',
            [group_pk, client_pk]
        );

        if (member.length === 0) {
            return res.status(403).json({ error: '해당 모임통장의 멤버가 아닙니다.' });
        }

        // 자동 이체 계좌가 사용자의 계좌인지 확인
        const [account] = await mysqldb.promise().execute(
            'SELECT * FROM Account WHERE account_pk = ? AND client_pk = ?',
            [auto_deposit_account_pk, client_pk]
        );

        if (account.length === 0) {
            return res.status(403).json({ error: '유효하지 않은 계좌입니다.' });
        }

        // 자동 이체 계좌 설정 업데이트
        await mysqldb.promise().execute(
            'UPDATE GroupAccountMember SET auto_deposit_account_pk = ? WHERE group_pk = ? AND client_pk = ?',
            [auto_deposit_account_pk, group_pk, client_pk]
        );

        res.json({ success: true, message: '자동 이체 계좌 설정이 성공적으로 업데이트되었습니다.' });
    } catch (error) {
        console.error('자동 이체 계좌 설정 업데이트 오류:', error);
        res.status(500).json({ error: '내부 서버 오류' });
    }
});

// 자동 입금 처리 함수
async function processAutoDeposits() {
    const today = new Date();
    const currentDay = today.getDate();

    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DB,
        });
        await connection.beginTransaction();

        console.log('데이터베이스 연결 성공');

        const [groups] = await connection.execute(
            'SELECT * FROM `Group` WHERE auto_deposit_day = ?',
            [currentDay]
        );
        console.log(`오늘 자동 입금이 필요한 그룹 수: ${groups.length}`);

        for (const group of groups) {
            console.log(`그룹 처리 중: ${group.group_pk}`);
            const [members] = await connection.execute(
                'SELECT gam.*, a.account_number, a.account_balance, gam.auto_deposit_account_pk FROM GroupAccountMember gam JOIN Account a ON gam.account_pk = a.account_pk WHERE gam.group_pk = ? AND gam.invite_status = "accepted"',
                [group.group_pk]
            );
            console.log(`그룹 멤버 수: ${members.length}`);

            for (const member of members) {
                console.log(`멤버 처리 중: ${member.client_pk}`);
                if (member.last_auto_deposit_date && new Date(member.last_auto_deposit_date).getMonth() === today.getMonth()) {
                    console.log('이미 이번 달에 입금함. 스킵.');
                    continue;
                }
        
                // 자동이체 계좌(출금 계좌) 잔액 확인
                const [autoDepositAccount] = await connection.execute(
                    'SELECT account_balance FROM Account WHERE account_pk = ?',
                    [member.auto_deposit_account_pk]
                );
        
                if (autoDepositAccount.length === 0 || autoDepositAccount[0].account_balance < group.auto_deposit_amount) {
                    console.log(`잔액 부족 또는 계좌 없음: ${member.auto_deposit_account_pk}`);
                    continue;
                }
        
                console.log('자동 입금 처리 시작');
                // 출금 계좌에서 금액 차감
                const [updateResult1] = await connection.execute(
                    'UPDATE Account SET account_balance = account_balance - ? WHERE account_pk = ?',
                    [group.auto_deposit_amount, member.auto_deposit_account_pk]
                );
                console.log(`출금 계좌 업데이트 결과: ${JSON.stringify(updateResult1)}`);
        
                // 그룹 계좌에 금액 입금
                const [updateResult2] = await connection.execute(
                    'UPDATE Account SET account_balance = account_balance + ? WHERE account_pk = ?',
                    [group.auto_deposit_amount, group.account_pk]
                );
                console.log(`그룹 계좌 업데이트 결과: ${JSON.stringify(updateResult2)}`);
        
                // 거래 내역 추가
                const [insertResult] = await connection.execute(
                    'INSERT INTO TransactionHistory (transaction_name, transaction_type, transaction_amount, transaction_balance, transaction_origin, transaction_destination, transaction_memo) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    ['자동 입금', 'AutoDeposit', group.auto_deposit_amount, autoDepositAccount[0].account_balance - group.auto_deposit_amount, member.auto_deposit_account_pk, group.account_pk, '모임통장 자동 입금']
                );
                console.log(`거래 내역 추가 결과: ${JSON.stringify(insertResult)}`);
        
                // 마지막 자동 입금 날짜 업데이트
                const [updateResult3] = await connection.execute(
                    'UPDATE GroupAccountMember SET last_auto_deposit_date = ? WHERE member_pk = ?',
                    [today, member.member_pk]
                );
                console.log(`마지막 자동 입금 날짜 업데이트 결과: ${JSON.stringify(updateResult3)}`);
            }
        
        }

        await connection.commit();
        console.log('트랜잭션 커밋 완료');
    } catch (error) {
        console.error('자동 입금 처리 오류:', error);
        if (connection) {
            await connection.rollback();
            console.log('트랜잭션 롤백 완료');
        }
    } finally {
        if (connection) {
            await connection.end();
            console.log('데이터베이스 연결 종료');
        }
    }
}

// 매일 자정에 자동 입금 처리 실행
schedule.scheduleJob('0 0 * * *', function() {
    processAutoDeposits();
});

router.post('/manual-auto-deposit', async (req, res) => {
    try {
        await processAutoDeposits();
        res.json({ success: true, message: '자동 입금이 수동으로 실행되었습니다.' });
    } catch (error) {
        console.error('자동 입금 수동 실행 오류:', error);
        res.status(500).json({ error: '자동 입금 수동 실행 오류' });
    }
});

module.exports = router;
