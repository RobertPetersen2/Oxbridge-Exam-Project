const mongoClient = require("mongodb").MongoClient; // <- NEW 
const objectId = require("mongodb").ObjectID; // <- NEW 

// MONGO DB
const CONNECTION_URL = "mongodb://localhost:27017";
var DATABASE_NAME = 'oxbridgeDb';

var db;

module.exports = {

    connect: callback => {
  
      mongoClient.connect(CONNECTION_URL, { useNewUrlParser: true }, (error, client) => {
          if (error) {
              throw error;
          }
          db = client.db(DATABASE_NAME);
          console.log("Connected to `" + DATABASE_NAME + "`!");
          callback(null);
      });
    },
    getDb: function() {
      return db;
    }


  };
