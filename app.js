var express = require("express");
var app = express();
var request = require("request");
app.set("view engine", "ejs");
var async = require("async");
var bodyParser = require('body-parser')
app.use(bodyParser.urlencoded({extended: true}));

var mongoose = require('mongoose');
mongoose.connect("mongodb://user:password@ds127993.mlab.com:27993/news-app-");
var userSchema = new mongoose.Schema({
    username: String,
    password: String,
    defaults: Array
});
var User = mongoose.model('User', userSchema);

var loggedIn = false;
var currentUser = null;
var maxpg = 0;
var arts = [];
var allSources = [];
var defaultSources = [];
var categories = [{category: "business", sources: []}, {category: "entertainment", sources: []}, {category: "gaming", sources: []}, {category: "general", sources: []}, {category: "music", sources: []}, {category: "politics", sources: []}, {category: "science-and-nature", sources: []}, {category: "sport", sources: []},{category: "technology", sources: []}];

async.each(categories, function(category){
    request("https://newsapi.org/v1/sources?category=" + category['category'] + "&apiKey=03cfb8dd19714f5287188cccfe3b8f70", function(error, response, body) {
        category['sources'] = JSON.parse(body)['sources'];
        async.each(category['sources'], function(source){
            allSources.push(source);
        });
    });
});

app.get('/', function(req, res){
    arts = [];
    if(!loggedIn)
        defaultSources = allSources;
    else
        defaultSources = currentUser['defaults'];
    async.each(defaultSources, function(source, callback1){
        request("https://newsapi.org/v1/articles?source=" + (source['id'] || source) + "&apiKey=03cfb8dd19714f5287188cccfe3b8f70", function(error, response, body) {
            async.each(JSON.parse(body)['articles'], function(article, callback2){
                arts.push({source: (source['name']||source), article: article});
                callback2();
            }, function(){
                callback1();
            });
        });
    }, function(){
        arts.sort(function(a,b){
            return new Date(b['article']['publishedAt']) - new Date(a['article']['publishedAt']);
        });
        maxpg = (arts.length - arts.length%10)/10;
        res.render("news", {currentUser: currentUser, loggedIn: loggedIn, maxpg: maxpg, pgnum: 1, arts: arts, categories: categories});
    });
});

app.get("/sign_up", function(req, res) {
   res.render("sign_up", {showErr: false, currentUser: currentUser, loggedIn: loggedIn}); 
});
app.get("/login", function(req, res){
   res.render("login",{currentUser: currentUser, loggedIn: loggedIn, showErr: false}); 
});
app.get('/logout', function(req, res){
   currentUser = null;
   loggedIn = false;
   res.redirect('/');
});
app.get('/settings', function(req, res){
   res.render('settings', {categories: categories, currentUser: currentUser, loggedIn: loggedIn, defaultSources: defaultSources}); 
});
app.get("/:num", function(req,res){
    res.render("news", {currentUser: currentUser, loggedIn: loggedIn, maxpg: maxpg, pgnum: req.params['num'], arts: arts, categories: categories}); 
});
app.get("/sources/:source", function(req, res){
   var url = "https://newsapi.org/v1/articles?source=" + req.params['source'] + "&apiKey=03cfb8dd19714f5287188cccfe3b8f70";
   request(url, function(error, response, body) {
       res.render("sources", {currentUser: currentUser, loggedIn: loggedIn, source: req.params['source'], arts: JSON.parse(body)['articles'], categories: categories});
   });
});
app.post('/defaults', function(req, res){
    User.find({username: currentUser['username']}, function(err, user){
        currentUser = user[0];
        User.remove({username: currentUser['username']});
        currentUser['defaults'] = req.body['source'];
        User.create(currentUser);
        res.redirect('/');
    });
});
app.post("/new_user", function(req, res){
    var newUser = {
      username: req.body.username,
      password: req.body.password,
      defaults: allSources
    };
    User.find({username: newUser['username']}, function(err, users){
        if(users[0] == null){
            User.create(newUser);
            currentUser = newUser;
            loggedIn = true;
            res.redirect('/');
        }
        else
            res.render("sign_up", {showErr: true, currentUser: currentUser, loggedIn: loggedIn});
    });
});

app.post('/login', function(req,res){
    User.find({username: req.body.username, password: req.body.password}, function(err, user){
        currentUser = user[0];
        if(user[0] != null)
        {
            loggedIn = true;
            res.redirect('/');
        }
        else
        {
            res.render("login",{currentUser: currentUser, loggedIn: loggedIn, showErr: true});
        }
    });
});

app.listen(process.env.PORT, process.env.IP, function(){
  console.log("Server Running"); 
});