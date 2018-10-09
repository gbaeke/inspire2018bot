/*-----------------------------------------------------------------------------
A simple Language Understanding (LUIS) bot for the Microsoft Bot Framework. 
-----------------------------------------------------------------------------*/

var restify = require('restify');
var builder = require('botbuilder');
var botbuilder_azure = require("botbuilder-azure");
var axios=require('axios');
var util=require('util');

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});
  
// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
    openIdMetadata: process.env.BotOpenIdMetadata 
});


// Listen for messages from users 
server.post('/api/messages', connector.listen());

/*----------------------------------------------------------------------------------------
* Bot Storage: This is a great spot to register the private state storage for your bot. 
* We provide adapters for Azure Table, CosmosDb, SQL Azure, or you can implement your own!
* For samples and documentation, see: https://github.com/Microsoft/BotBuilder-Azure
* ---------------------------------------------------------------------------------------- */

var tableName = 'botdata';
var azureTableClient = new botbuilder_azure.AzureTableClient(tableName, process.env['AzureWebJobsStorage']);
var tableStorage = new botbuilder_azure.AzureBotStorage({ gzipData: false }, azureTableClient);

// Create your bot with a function to receive messages from the user
// This default message handler is invoked if the user's utterance doesn't
// match any intents handled by other dialogs.
var bot = new builder.UniversalBot(connector, function (session, args) {
    session.send('You reached the default message handler. You said \'%s\'.', session.message.text);
});

bot.set('storage', tableStorage);

// Make sure you add code to validate these fields
var luisAppId = process.env.LuisAppId;
var luisAPIKey = process.env.LuisAPIKey;
var luisAPIHostName = process.env.LuisAPIHostName || 'westus.api.cognitive.microsoft.com';

const LuisModelUrl = 'https://' + luisAPIHostName + '/luis/v2.0/apps/' + luisAppId + '?subscription-key=' + luisAPIKey;

// Create a recognizer that gets intents from LUIS, and add it to the bot
var recognizer = new builder.LuisRecognizer(LuisModelUrl);
bot.recognizer(recognizer);

// Add a dialog for each intent that the LUIS app recognizes.
// See https://docs.microsoft.com/en-us/bot-framework/nodejs/bot-builder-nodejs-recognize-intent-luis 
bot.dialog('GreetingDialog',
    (session) => {
        var responseText = 'Hello! Great to see you!';
        session.say(responseText, responseText);
        session.endDialog();
    }
).triggerAction({
    matches: 'Greeting'
})

bot.dialog('GetSentimentDialog',
    (session, args) => {
        var intent = args.intent;
        var eventNameEntity = builder.EntityRecognizer.findEntity(intent.entities, 'event');
        console.log(eventNameEntity);
        var eventName = eventNameEntity ? eventNameEntity.entity : null;
        console.log(eventName);
        if(eventName == null || eventName=='inspire' || eventName=='here') {
            console.log(eventName);
            axios.get('https://xylosinspire2018.azurewebsites.net/api/AverageSentiment')
                .then(function(response){
                    var score=response.data.score;
                    var sentiment='just ok';
                    if(score < 0.5) {
                        sentiment='bad news';
                    } else if (score > 0.5) {
                        sentiment='great news';
                    }
                    
                    var responseText=util.format("The average sentiment score is %s, which is %s.", Math.round(score*100) / 100, sentiment);
                    session.say(responseText, responseText);
                    session.endDialog();
                })
                .catch(function(error){
                    console.log(error);
                    session.endDialog();
                });
        } else {
            console.log(eventName);
            var responseText=util.format("I don't know anything about that. I need more data!");
            session.say(responseText, responseText);
            session.endDialog();
        }
                
    }
).triggerAction({
    matches: 'GetSentiment'
})

bot.dialog('GetTweetDialog',
    (session) => {
        axios.get('https://xylosinspire2018.azurewebsites.net/api/LastTweet')
            .then(function(response){
                var sender=response.data.sender;
                var tweet=response.data.text;
                
                var responseText=util.format("This is the last tweet by %s. %s", sender, tweet);
                session.say(responseText, responseText);
                session.endDialog();
            })
            .catch(function(error){
                console.log(error);
                session.endDialog();
            });
        
        
    }
).triggerAction({
    matches: 'GetTweet'
})

bot.dialog('HelpDialog',
    (session) => {
        var responseText = 'Calling 9 1 1 now!';
        session.say(responseText, responseText);
        session.endDialog();
    }
).triggerAction({
    matches: 'Help'
})

bot.dialog('CancelDialog',
    (session) => {
        session.send('What? You said: \'%s\'.', session.message.text);
        session.endDialog();
    }
).triggerAction({
    matches: 'Cancel'
})

