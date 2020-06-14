var mongoose = require('mongoose');
// This one is used to keep a reference to the individual user of the team
// var UserSchema = mongoose.model('users').schema;
var Schema = mongoose.Schema;

var subDoc = new Schema({
    username: String,
    fullname: String,
    isTeamLeader: Boolean
  });

var TeamSchema = new Schema({
    teamName: String,
    users: [subDoc]
});

module.exports = mongoose.model('teams',TeamSchema);