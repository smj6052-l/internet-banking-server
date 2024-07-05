const sequelize = require("../config/database");
const Client = require("./Client");
const Account = require("./Account");

// 다른 모델들을 여기에 추가합니다.
// const Group = require('./Group');
// const GroupAccountMember = require('./GroupAccountMember');
// const TransactionHistory = require('./TransactionHistory');

// 모델 관계 정의 (외래 키 연결)
Client.hasMany(Account, { foreignKey: "client_pk" });
Account.belongsTo(Client, { foreignKey: "client_pk" });

// 다른 모델 관계도 추가합니다.
// Account.hasMany(Group, { foreignKey: 'account_pk' });
// Group.belongsTo(Account, { foreignKey: 'account_pk' });

// Group.hasMany(GroupAccountMember, { foreignKey: 'group_pk' });
// GroupAccountMember.belongsTo(Group, { foreignKey: 'group_pk' });

// TransactionHistory.belongsTo(Account, { as: 'origin', foreignKey: 'transaction_origin' });
// TransactionHistory.belongsTo(Account, { as: 'destination', foreignKey: 'transaction_destination' });

const initializeDatabase = async () => {
  try {
    await sequelize.sync({ force: true }); // 데이터베이스 초기화 (기존 데이터 삭제)
    console.log("Database synchronized successfully.");

    // 초기 데이터 삽입 (필요할 경우)
    await Client.create({
      client_id: "testuser",
      client_name: "Test User",
      client_pw: "hashedpassword",
      client_email: "test@example.com",
      client_phone: "01234567890",
      client_address: "123 Test St",
      client_resi: "123456-7890124",
    });
  } catch (error) {
    console.error("Error synchronizing database:", error);
  }
};

module.exports = { initializeDatabase };
