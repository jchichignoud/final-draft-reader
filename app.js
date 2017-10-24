var express = require('express');
var app = express();

app.use(express.static("public"));

app.set("view engine", "ejs");

// viewed at based directory http://localhost:8080/
app.get("/", function (req, res){
    res.render("index");
});

console.log("Server started");

app.listen(process.env.PORT, process.env.IP);