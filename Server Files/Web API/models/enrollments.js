var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var EnrollmentSchema = new Schema({
    username: String,
    team: String
});

module.exports = mongoose.model('enrollment',EnrollmentSchema);