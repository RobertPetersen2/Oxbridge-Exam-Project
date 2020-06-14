var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var subDoc = new Schema({
    teamName: String
  });

var RaceSchema = new Schema({
    raceID: Number,
    startTime: { type: Date, default: "1899-12-31T23:59:59.000Z" },
    locationDescription: String,
    checkPoints:[{
        latitude: Number,
        longitude: Number
    }],
    laps: Number,
    assignedTeams:{
        type: [subDoc], default: []
    }
});



module.exports = mongoose.model('races',RaceSchema);