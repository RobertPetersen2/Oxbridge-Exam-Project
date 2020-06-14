var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var UserSchema = new Schema({
    fullName: String,
    username: String,
    password: String,
    isTeamLeader: { type: Boolean, default: false },
    isAdmin: { type: Boolean, default: false },
    team: { type: String, default: null } //<-- Nullable if no team is assigned 
});

module.exports = mongoose.model('users',UserSchema);