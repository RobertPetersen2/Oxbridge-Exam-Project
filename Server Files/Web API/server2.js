// BASE FOR THE SERVER 
var express = require('express');

var app = express();
var http = require('http').createServer(app);
var io = require('socket.io')(http);

// MongoDB service
var dbService = require('./services/dbService');
var raceService = require('./services/raceService');

// CORS headers inserted automatically  
const cors = require('cors');
app.use(cors());
// var mongoose = require('mongoose');
var bodyParser = require('body-parser');

var urlencode = bodyParser.urlencoded({ extended: true });
app.use(express.static('public'));
app.use(bodyParser.json());

const publicIp = require('public-ip');


// MODELS (NOTICE THIS IS IN ANOTHER FOLDER)
var User = require('./models/user');

// ROUTING
var router = express.Router();

// TO PROCESS THE NEXT REQUEST !!
router.use(function (req, res, next) {
    console.log("recieved a request now, ready for the next");
    next();
});


// Routing
app.use('/', router); // here you could put in a prefix !!


// io.on('connection', (socket) => {
//     console.log('a user connected');

//     // socket.on('hi', (msg) => {
//     //     console.log(msg);
//     //     io.emit('hi', "Welcome to the server");
//     //   });
//     socket.on('race', (msg) => {
//         var obj = JSON.parse(msg);
//         console.log(obj.Header);
//         //handle coordinate
//         if(obj.Header==="coordinate"){
//             io.emit('race', msg);
//         }
//         //handle startrace
//         if(obj.Header==="startrace"){
//             io.emit('startrace', msg);
//         }
//     });
// });

// io.on("disconnect", (socket) =>{
    
//     //var socket is the socket for the client who has disconnected.
//     console.log("disconnected");
// })

// io.sockets.on("disconnect",function(socket){
//     //var socket is the socket for the client who has disconnected.
//     console.log("disconnected");
// })

// SERVER START : 3000 : process.env.PORT
http.listen(3000, () => {

    publicIp.v4().then(ip => {
        console.log("your public ip address", ip);
      });

    // App Start
    dbService.connect(err => {
        if (err) {
            console.log("Error: ", err);
            process.exit(1);
        }

        // If connection is successful we will require all other routes that use the db
        var authController = require('./controllers/authenticationController');
        var teamController = require('./controllers/teamManagementController');
        var raceController = require('./controllers/raceController');
        var enrollmentController = require('./controllers/enrollmentController');
        app.use("/authentication",authController);
        app.use("/teams",teamController);
        app.use("/races",raceController);
        app.use("/enrollment",enrollmentController);

        // Pass the socket connection to race service: 
        raceService.createSocket(io)

    });



});
module.exports = app;  // important!!
