const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Client = sequelize.define(
  "Client",
  {
    client_pk: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
      comment: "AutoIncrement, PK",
    },
    client_id: {
      type: DataTypes.STRING(40),
      allowNull: false,
      unique: true,
      comment: "UNIQUE",
    },
    client_name: {
      type: DataTypes.STRING(40),
      allowNull: false,
    },
    client_pw: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    client_email: {
      type: DataTypes.STRING(40),
      allowNull: false,
    },
    client_phone: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      comment: "UNIQUE",
    },
    client_address: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    client_resi: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      comment: "UNIQUE",
    },
    client_join_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    client_photo: {
      type: DataTypes.BLOB,
    },
    client_login_attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Counts the number of failed login attempts",
    },
  },
  {
    tableName: "Client",
    timestamps: false,
  }
);

module.exports = Client;
