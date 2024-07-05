const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Client = require("./Client");

const Account = sequelize.define(
  "Account",
  {
    account_pk: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
      comment: "AutoIncrement, PK",
    },
    client_pk: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Client,
        key: "client_pk",
      },
      comment: "FK",
    },
    account_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      comment: "UNIQUE",
    },
    account_name: {
      type: DataTypes.STRING(40),
      allowNull: false,
    },
    account_type: {
      type: DataTypes.STRING(40),
      allowNull: false,
    },
    account_balance: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    account_pw: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    account_photo: {
      type: DataTypes.BLOB,
    },
    account_reg_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    day_transfer_limit: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    account_status: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
  },
  {
    tableName: "Account",
    timestamps: false,
  }
);

module.exports = Account;
