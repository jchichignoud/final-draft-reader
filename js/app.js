var xmlDoc = null;
var scriptJson = {};
var currentScene = null;
var currentSpeech = null;
var scenesList = []


///////////////////////////////////
////////HANDLE USER FILE///////////
///////////////////////////////////

// WHEN CHANGE IS DETECTED IN INPUT FIELD (file selected by user)
function onChange(event) {
    // select first element of user files (always returns an array)
    var file = event.target.files[0];
    var reader = new FileReader();
    reader.onload = function (event) {
        parser = new DOMParser();
        xmlDoc = parser.parseFromString(event.target.result, "text/xml");
        sendToParse()
    };
    reader.readAsText(file);

}

// click on character name highlights all their dialogue
// $(document).on("click", '.character', function(event) { 
//     console.log(event.target.innerText);
//     $("div[data-speakingcharacter='" + event.target.innerText + "']").toggleClass("highlight");
// });


function sendToParse() {
    if (!xmlDoc) {
        window.alert("There's nothing loaded")
        return;
    }
    parseToJson(xmlDoc);
    if (!scriptJson.FinalDraft){
        alert("this is not a valid file")
        return;
    }
    //contains only the script elements, no extra stuff
    var scriptContent = scriptJson.FinalDraft[0].Content;
    parseToHTML(scriptContent);
};



// ON BUTTON CLICK, CHECK IF FILE IS LOADED + CHECK IF VALID
$("button").click(function () {
    if (!xmlDoc) {
        window.alert("There's nothing loaded")
        return;
    }
    parseToJson(xmlDoc);
    if (!scriptJson.FinalDraft){
        alert("this is not a valid file")
        return;
    }
    //contains only the script elements, no extra stuff
    var scriptContent = scriptJson.FinalDraft[0].Content;
    parseToHTML(scriptContent);
});


// parseToJson (called by button click)
function parseToJson(xml) {
        scriptJson = xml2json(xml) // send the responseXML of the request to xml2json script
        scriptJson = JSON.parse(scriptJson); // parse    
};

// parseToHTML (called on scriptContent by button click)
function parseToHTML(scriptArray){
    addCoverPage();
    scriptArray.forEach(function (element, index, array){
        // console.log(element);
        if (element.ParagraphType === "Scene Heading") { // if current element is a heading
            if(currentScene){ // and if currentScene isn't empty
                addSceneToScript(currentScene); // add previous scene to the page   
            };
            currentScene = {}
            currentScene.text = ""
            currentScene.sceneNumber = element.ParagraphNumber;
            currentScene.sceneTitle = element.Paragraph.Text; // might want to split the INT/EXT and ToD out for extra metadata
            if (element.Paragraph.SceneProperties && ("Summary" in element.Paragraph.SceneProperties) && ("Paragraph" in element.Paragraph.SceneProperties.Summary) && ("Text" in element.Paragraph.SceneProperties.Summary.Paragraph)){
                // can break down above in several if statements to extra other info (scene number etc)
                currentScene.sceneSummary = element.Paragraph.SceneProperties.Summary.Paragraph.Text;
                // console.log(currentScene.sceneSummary);
            } else {
                currentScene.sceneSummary = ""
                // console.log("no scene summary");
            }
            
        } else if (element.ParagraphType === "Action"){
            if(currentScene){ // doesn't display anything that comes before the first scene heading, need fixing
                addActionToScene(element)
            } else {
                addElementToScript(element)
            }    
        } else if (element.ParagraphType === "Character"){
            currentSpeech = {}
            currentSpeech.text = ""
            characterClean = textWithoutDecoration(element.Paragraph);
            currentSpeech.speakingCharacter = characterClean.toUpperCase(); // will need to extract in-line parenthesis
            currentSpeech.extraInfo = ""; // will extract later
            currentSpeech.isClosed = false;
            currentSpeech.isDual = false; 
            // currentSpeech.text = "<h5 class='character'>" + characterClean + "</h5>"
            // if the next item is neither parenthesis nor dialogue, add the currentSpeech to the scene
        } else if (element.ParagraphType === "Dialogue" || element.ParagraphType === "Parenthetical"){
            // this catches user errors where they start dialogue without setting the character. uses previous speech character and adds it to the bubble
            if (!currentSpeech.isClosed) {
                addToSpeech(element);
            } else {
                currentSpeech.text = "";
                addToSpeech(element);
            }
            // console.log(element.ParagraphType);
            if (index === array.length - 1) { // if this is the end of the script
                addSpeechToScene(element)
            } else if (!(scriptArray[index + 1].ParagraphType === "Parenthetical") && !(scriptArray[index + 1].ParagraphType === "Dialogue")){
                // if the next item is neither Dialogue nor Parenthetical
                addSpeechToScene(element);
                currentSpeech.isClosed = true
            };
        } else if (element.ParagraphType === "General" && element.Paragraph.DualDialogue){
            element.Paragraph.DualDialogue.forEach(function (element, index, array){
                if (element.ParagraphType === "Character"){
                    currentSpeech = {}
                    currentSpeech.text = ""
                    characterClean = textWithoutDecoration(element.Paragraph);
                    currentSpeech.speakingCharacter = characterClean; // will need to extract in-line parenthesis
                    currentSpeech.extraInfo = ""; // will extract later
                    currentSpeech.isClosed = false;
                    currentSpeech.isDual = true; 
                } else if (element.ParagraphType === "Dialogue" || element.ParagraphType === "Parenthetical"){
                    // this catches user errors where they start dialogue without setting the character. uses previous speech character and adds it to the bubble
                    if (!currentSpeech.isClosed) {
                        addToSpeech(element);
                    } else {
                        currentSpeech.text = "";
                        addToSpeech(element);
                    }
                    if (index === array.length - 1) { // if this is the end of the script
                        addSpeechToScene(element)
                    } else if (!(scriptArray[index + 1].ParagraphType === "Parenthetical") && !(scriptArray[index + 1].ParagraphType === "Dialogue")){
                        // if the next item is neither Dialogue nor Parenthetical
                        addSpeechToScene(element);
                        currentSpeech.isClosed = true
                    }
                }
            }); 
        } else {
            //catch all for everything that's not one of the above
            if (currentScene){
                addActionToScene(element)
            } else {
                addElementToScript(element)
            }
        };
        if ((index === array.length - 1) && currentScene) {
            // console.log("this is the last item on the script: " + textWithoutDecoration(element.Paragraph.Text));
            addSceneToScript(currentScene);
        }        
    });
// $(function() {
//   stickyHeaders.load($(".followMeBar"));
// });
};




///////////////////////////////////
////////ADDING TO HTML/////////////
///////////////////////////////////

function addCoverPage(coverObject){
    $('#cover').append("<div class='cover'><h1 class='title'>Title will go here</h1><h2>Writer, etc...</div>");
};

function addSceneToScript(sceneObject){
    if(sceneObject.sceneNumber){
        $('#script').append("<div class='scene'><h3 class='sceneheading followMeBar'>" + "<span class='scenenumber'>" + sceneObject.sceneNumber + "</span> " + sceneObject.sceneTitle + "</h3>" + sceneObject.text + "</div>");
    } else {
        $('#script').append("<div class='scene'><h3 class='sceneheading followMeBar'>" + sceneObject.sceneTitle + "</h3>" + sceneObject.text + "</div>");
    }
    
    scenesList.push(currentScene);
    currentScene = null // reset currentScene
};

function addElementToScript(elementObject){
    newClass = elementObject.ParagraphType.toLowerCase().replace(/\s+/g, '');
    string = elementObject.Paragraph.Text; 
    if (string) {
        $('#script').append("<div class='" + newClass + "'><p>" + string + "</p></div>");
    }
};

function addActionToScene(actionObject){
    // set up class to be added to HTML, in lowercase without spaces
    newClass = actionObject.ParagraphType.toLowerCase().replace(/\s+/g, '');
    string = textWithoutDecoration(actionObject.Paragraph);
    if (string) {
        currentScene.text += "<p class=" + newClass + ">" + string + "</p>";
    }
    // add the string in a new paragraph   
};

function addSpeechToScene(speechObject){
    if (currentSpeech.isDual){
        newClass = "dual speech"
    } else {
        newClass = "speech"
    }
    speakingCharacter = currentSpeech.speakingCharacter;
    // console.log(currentSpeech)
    // add the string in a new paragraph? might want to differentiate between parenthetical and dialogue
    currentScene.text += "<div class='" + newClass + "' data-speakingcharacter='" + speakingCharacter + "''>" + "<h5 class='character'>" + speakingCharacter + "</h5>" + currentSpeech.text + "</div>";
    currentSpeech.isClosed = true
};

function addToSpeech(dialogueObject){
    if(textWithoutDecoration(dialogueObject.Paragraph)){
        newClass = dialogueObject.ParagraphType.toLowerCase().replace(/\s+/g, '');
        string = textWithoutDecoration(dialogueObject.Paragraph);
        // add the string in a new paragraph? might want to differentiate between parenthetical and dialogue
        currentSpeech.text += "<p class=" + newClass + ">" + string + "</p>";
    }
};


// send in the element.Paragraph.Text to get a proper string
function textWithoutDecoration(stringOrArray) {
    currentString = "";
    if (Array.isArray(stringOrArray)) {
        stringOrArray.forEach(function (subObject) {
            // set scriptString to the sum of all substrings
            //might want to read the extra info to italicize what needs to be
            currentString = currentString + subObject.Text;
        })
        // after all array elements added to the string, a
        return currentString;
    } else if (stringOrArray.Text) {
        // else if it's not an array, and there's text in it, just grab the text
        currentString = stringOrArray.Text;
        return currentString;
    };
}

// send in the element.Paragraph
function textWithDecoration(styledArray) {
    var text = ""
    styledArray.forEach(function (subObject) {
        var styledText = subObject.Text
        if(subObject.TextStyle) {
            var styles = subObject.TextStyle.split("+");
            styles.forEach(function (style){
                if (style === "Bold") {
                    styledText = "<strong>" + styledText + "</strong>";       
                }
                if (style === "Underline") {
                    styledText = "<span class='underline'>" + styledText + "</span>";       
                }
                if (style === "Italic") {
                    styledText = "<em>" + styledText + "</em>";       
                } 
            });
        }
        text = text + styledText;     
    });
    return text
};

//check for nested object without getting an undefined error if the middle levels don't exist
function get(obj, key) {
    return key.split(".").reduce(function(o, x) {
        return (typeof o == "undefined" || o === null) ? o : o[x];
    }, obj);
}
// usage: 
// get(object, 'loc.foo.bar') // will either return undefined or the value




// function parseToHTMLv2(scriptArray){
//     addCoverPage();
//     scriptArray.forEach(function (element, index, array){
//         objFunctions(element.ParagraphType);
//     });
// };




//declare an object holding all functions, to be called based on ParagraphType, passing in element.Paragraph, might need amn extra true/false argument based on what the next item is or if there's something to send to script
// function objFunctions =  {
//     "Action": function(){console.log("this is an action")},
//     "Character": function(){console.log("this is a character")},
//     "Dialogue": function(){console.log("this is a dialogue")},
//     "Scene Heading": function(){console.log("this is a scene heading")},
//     "General": function(){console.log("this is a general")},
//     "Scene Heading": function(){console.log("This is a parenthesis")},
//     "Scene Heading": function(){console.log("This is a title")},
// }

// CharacterArcBeatName property in each scene heading, listing all characters in the scene. also listing scene length (in page eigths), page it appears on, and title (seems empty in files I have), as well as scene numbers?

// where to put transition indications? fade in/out, dissolves, etc... Inside a scene or between them?
// should I add a separator between scenes? maybe add the transition indications into it?




// GENERAL treat like action? no class?
// DUAL DIALOGUE IS A SUBTYPE OF GENERAL
//--------------------SCENE HEADING
//--------------------ACTION
//--------------------CHARACTER
//--------------------PARENTHETICAL
//--------------------DIALOGUE
// TRANSITION treat as action?
// SHOT treat like action? special class, might add icon
// CAST LIST ignore?
// SCRIPT TITLE ignore if title on cover page?
// END OF SCRIPT optional so treat like text?

// NEW ACT -- if present in document, needs to add an extra level of containers for acts
// END OF ACT -- if present in document, needs to add an extra level of containers for acts
// COLD OPENING -- if present in document, needs to add an extra level of containers for acts
// SHOW/EP. TITLE -- treat as script title above?
// SINGING?

// FinaCut[n].Cast, list of all characters
// FinalCut[n].SmartType INT/EXT, ToD and Locations
// FinalCu[n].TitlePage

// Text.Style =[Italic, Underline, Bold, Bold+Underline, AllCaps]








////////////
// var stickyHeaders = (function() {

//   var $window = $(window),
//       $stickies;

//   var load = function(stickies) {

//     if (typeof stickies === "object" && stickies instanceof jQuery && stickies.length > 0) {

//       $stickies = stickies.each(function() {

//         var $thisSticky = $(this).wrap('<div class="followWrap" />');
  
//         $thisSticky
//             .data('originalPosition', $thisSticky.offset().top)
//             .data('originalHeight', $thisSticky.outerHeight())
//               .parent()
//               .height($thisSticky.outerHeight());             
//       });

//       $window.off("scroll.stickies").on("scroll.stickies", function() {
//           _whenScrolling();     
//       });
//     }
//   };

//   var _whenScrolling = function() {

//     $stickies.each(function(i) {            

//       var $thisSticky = $(this),
//           $stickyPosition = $thisSticky.data('originalPosition');

//       if ($stickyPosition <= $window.scrollTop()) {        
        
//         var $nextSticky = $stickies.eq(i + 1),
//             $nextStickyPosition = $nextSticky.data('originalPosition') - $thisSticky.data('originalHeight');

//         $thisSticky.addClass("fixed");

//         if ($nextSticky.length > 0 && $thisSticky.offset().top >= $nextStickyPosition) {

//           $thisSticky.addClass("absolute").css("top", $nextStickyPosition);
//         }

//       } else {
        
//         var $prevSticky = $stickies.eq(i - 1);

//         $thisSticky.removeClass("fixed");

//         if ($prevSticky.length > 0 && $window.scrollTop() <= $thisSticky.data('originalPosition') - $thisSticky.data('originalHeight')) {

//           $prevSticky.removeClass("absolute").removeAttr("style");
//         }
//       }
//     });
//   };

//   return {
//     load: load
//   };
// })();

