var io = require('socket.io');

var currentRace;
var actualStartTime;
var lobbyOpen = false;
let leaderboard = new Map();
var tempList = [];
var jsonSortedLeaderboard = [];

module.exports = {

    /**
     * Creating a socket and setting up how to handle communication
     * Currently only one race at the time
    */ 
    createSocket: function (ioInstance) {
        io = ioInstance;
        io.on('connection', (socket) => {
            console.log('a user connected');

            socket.on('race', (msg) => {
                var obj = JSON.parse(msg);

                if (obj.Header === "addtoleaderboard") {
                    leaderboard.set(obj.TeamName, []);
                    console.log(leaderboard);
                }
                //handle coordinate
                if (obj.Header === "coordinate") {
                    io.emit('race', msg);
                }
                //handle startrace
                if (obj.Header === "startrace") { //not used since race is started through http request
                    this.beginRace;
                }
                if (obj.Header === "checkpoint") {
                    //add timestamp to object
                    var date = new Date();
                    date = this.convertToDanishTime(date);
                    //getting the list of "checkpoints" by looking up the key/TeamName
                    var list = leaderboard.get(obj.TeamName);
                    //adding new "checkpoint" to the list
                    list.push({
                        Tag: obj.Tag, CompleteTime: date
                    });
                    //sending updated leaderboard to all clients
                    var sortedLeaderboard = {};
                    sortedLeaderboard.Leaderboard = this.sortLeaderboard(leaderboard);
                    //adding properties to handle object on client
                    sortedLeaderboard.Header = "checkpoint"; 
                    sortedLeaderboard.TeamName = "";
                    console.log(sortedLeaderboard);
                    jsonSortedLeaderboard = JSON.stringify(sortedLeaderboard);

                    io.emit('race', jsonSortedLeaderboard); 
                }
            });
        });
    },

    /**
     * homemade danish localtime since locales do not work and/or are garbage!
     */ 
    convertToDanishTime: function (date) {
        date.setHours(date.getHours() + 4);
        return date;
    },

    /**
     * function used to add an element with this specific definition to a list
     */
    addToTempList: function(value,key)
    {
        if(value.length>0){
            var temp = {TeamName: key, Tag: value[value.length-1].Tag, CompleteTime: value[value.length-1].CompleteTime}
            tempList.push(temp);
        }
    },

    /**
     * Using a sorting algorithm to sort the input collection and output the sorted collection
     */
    sortLeaderboard: function (leaderboard) {
        tempList = [];
        leaderboard.forEach(this.addToTempList);
        tempList.sort((a, b) => (a.Tag < b.Tag) ? 1 : (a.Tag === b.Tag) ? ((a.CompleteTime > b.CompleteTime) ? 1 : -1) : -1 );
        
        return tempList;
    },

    /**
     * Getter for access to leaderboard from outside
     */
    getSortedLeaderboard: function(){
        return jsonSortedLeaderboard;
    },

    /**
     * Used to notify/emit to all connected clients that the race has started
     */
    beginRace: function (race) {
        var msg = {
            Header: "startrace",
            TeamName: ""
        };
        io.emit('race', msg);
        console.log("*** race started")
    },

    /**
     * not implemented
     */
    stopRace: function () {

    },

    // io.on("disconnect", (socket) =>{

    //     //var socket is the socket for the client who has disconnected.
    //     console.log("disconnected");
    // })

    // io.sockets.on("disconnect",function(socket){
    //     //var socket is the socket for the client who has disconnected.
    //     console.log("disconnected");
    // })
};
