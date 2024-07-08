const verifyClient = async (sessionClient, mysqldb) => {
  if (!sessionClient || !sessionClient.client_pk) {
    return false;
  }

  try {
    const [results] = await mysqldb
      .promise()
      .query("SELECT client_pk FROM Client WHERE client_pk = ?", [
        sessionClient.client_pk,
      ]);
    return results.length > 0;
  } catch (error) {
    console.error("Error verifying client:", error);
    return false;
  }
};

module.exports = {
  verifyClient,
};
