/* eslint-disable  func-names */
/* eslint-disable  no-console */
/* eslint-disable  no-restricted-syntax */
const Alexa = require('ask-sdk-core');
const AWS = require('aws-sdk');
const ddbAdapter = require('ask-sdk-dynamodb-persistence-adapter'); // included in ask-sdk
const i18n = require('i18next');
const sprintf = require('i18next-sprintf-postprocessor');
const { Configuration, OpenAIApi } = require('openai');
const keys = require('./keys');
const languageStrings = {
  'en': require('./languages/en')
}

const config = new Configuration({
    apiKey: keys.OPEN_AI_KEY
});

const openai = new OpenAIApi(config);

const DOCUMENT_ID = "visual-response";

const datasource = {
    "headlineTemplateData": {
        "type": "object",
        "objectId": "headlineSample",
        "properties": {
            "backgroundImage": {
                "contentDescription": null,
                "smallSourceUrl": null,
                "largeSourceUrl": null,
                "sources": [
                    {
                        "url": "https://inteligenciadascoisas.com/post/20221209-t%c3%a1-assustado-com-as-evolu%c3%a7%c3%b5es-das-ias-olha-ent%c3%a3o-esse-chat-gtp/capa.jpg",
                        "size": "large"
                    }
                ]
            },
            "textContent": {
                "primaryText": {
                    "type": "PlainText",
                    "text": "texto"
                }
            },
            "logoUrl": "https://openaichatgpt.com.br/wp-content/uploads/2022/12/cxv1.png",
            "hintText": "Try asking, \"Question, what is the Linux command to shut down the PC?\""
        }
    }
};

const createDirectivePayload = (aplDocumentId, dataSources = {}, tokenId = "documentToken") => {
    return {
        type: "Alexa.Presentation.APL.RenderDocument",
        token: tokenId,
        document: {
            type: "Link",
            src: "doc://alexa/apl/documents/" + aplDocumentId
        },
        datasources: dataSources
    }
};

async function connectChatGPT(question) {
    console.log("[[[[DEBUG: connectChatGPT: USER_QUESTION == ", question, " ]]]]");
    const response =  await openai.createCompletion({
        model: 'text-davinci-003',
        prompt: question,
        temperature: 0,
        max_tokens: 1500,
        top_p: 1,
        frequency_penalty: 0.0,
        presence_penalty: 0.0
    });
    console.log("[[[[DEBUG: connectChatGPT: RESPONSE_DATA == ", response.data.choices[0].text, " ]]]]");

    return response.data.choices[0].text;
}

const LaunchRequest = {
    canHandle(handlerInput) {
        console.log("DEBUG: LaunchRequest handler");
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        console.log("Incoming Request: ", JSON.stringify(handlerInput.requestEnvelope));
        console.log("DEBUG: REQUEST TYPE ", Alexa.getRequestType(handlerInput.requestEnvelope));
        
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
        const speechOutput = requestAttributes.t('LAUNCH_MESSAGE');
        const reprompt = requestAttributes.t('LAUNCH_MESSAGE')
        
        if (Alexa.getSupportedInterfaces(handlerInput.requestEnvelope)['Alexa.Presentation.APL']) {
            datasource.headlineTemplateData.properties.textContent.primaryText.text = "Welcome to Alexa-hosted ChatGPT!"
            // generate the APL RenderDocument directive that will be returned from your skill
            const aplDirective = createDirectivePayload(DOCUMENT_ID, datasource);
            // add the RenderDocument directive to the responseBuilder
            handlerInput.responseBuilder.addDirective(aplDirective);
        }
        
        return handlerInput.responseBuilder
            .speak(speechOutput)
            .reprompt(reprompt)
            .getResponse();
    }
};

const ChatGptIntent = {
    canHandle(handlerInput) {
        console.log("DEBUG: ChatGptIntent handler");
        console.log("Incoming Request: ", JSON.stringify(handlerInput.requestEnvelope));
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' 
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'ChatGptIntent';
    },
    async handle(handlerInput) {
        console.log("Incoming Request: ", JSON.stringify(handlerInput.requestEnvelope));
        console.log("DEBUG: REQUEST TYPE ", Alexa.getRequestType(handlerInput.requestEnvelope))
        console.log("DEBUG: INTENT NAME ", Alexa.getIntentName(handlerInput.requestEnvelope))
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
        const question = Alexa.getSlotValue(handlerInput.requestEnvelope, 'question');
        
        try {
            const response = await connectChatGPT(question);
            if (question && !response) {
                console.log("[[[[DEBUG: ChatGptIntent: No response from OpenAI", response, " ]]]]")
                return handlerInput.responseBuilder
                    .speak(requestAttributes.t('NO_RESPONSE'))
                    .reprompt(requestAttributes.t('CONTINUE_MESSAGE'))
                    .withShouldEndSession(false)
                    .getResponse();
            } else if (!question && response){
                console.log("[[[[DEBUG: ChatGptIntent: No question from user: ", question, " ]]]]")
                return handlerInput.responseBuilder
                    .speak(requestAttributes.t('NO_QUESTION'))
                    .reprompt(requestAttributes.t('CONTINUE_MESSAGE'))
                    .withShouldEndSession(false)
                    .getResponse();
            } else if (question && response) {
                const speakOutput = response;
                console.log('!!!!!!!!!!!!!!!!!!!!!! CONNECTED TO OPENAI !!!!!!!!!!!!!!!!!!!!')
                console.log("[[[[DEBUG: ChatGptIntent: Reponse from OpenAI", response, " ]]]]")
                
                if (Alexa.getSupportedInterfaces(handlerInput.requestEnvelope)['Alexa.Presentation.APL']) {
                    datasource.headlineTemplateData.properties.textContent.primaryText.text = "Welcome to Alexa-hosted ChatGPT!"
                    // generate the APL RenderDocument directive that will be returned from your skill
                    const aplDirective = createDirectivePayload(DOCUMENT_ID, datasource);
                    // add the RenderDocument directive to the responseBuilder
                    handlerInput.responseBuilder.addDirective(aplDirective);
                }
                
                return handlerInput.responseBuilder
                    .speak(speakOutput)
                    .reprompt(requestAttributes.t('CONTINUE_MESSAGE'))
                    .withShouldEndSession(false)
                    .getResponse();
            }
        
        } catch (error) {
            console.error("Error while calling OpenAI API: ", error);
            // Handle error, maybe send a generic response to the user or a prompt to retry
            return handlerInput.responseBuilder
                .speak(requestAttributes.t('OPENAI_ERROR_MESSAGE'))
                .reprompt(requestAttributes.t('CONTINUE_MESSAGE'))
                .withShouldEndSession(false)
                .getResponse();
        }
      },
};

// const PetVetIntent = {
//     canHandle(handlerInput) {
//         console.log("DEBUG: PetVetIntent handler");
//         console.log("Incoming Request: ", JSON.stringify(handlerInput.requestEnvelope));
//         return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' 
//             && Alexa.getIntentName(handlerInput.requestEnvelope) === 'PetVetIntent';
//     },
//     async handle(handlerInput) {
//         console.log("Incoming Request: ", JSON.stringify(handlerInput.requestEnvelope));
//         console.log("DEBUG: REQUEST TYPE ", Alexa.getRequestType(handlerInput.requestEnvelope))
//         console.log("DEBUG: INTENT NAME ", Alexa.getIntentName(handlerInput.requestEnvelope))
//         const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
//         const question = `
//             Your Role
//             You are an experienced pet veterinarian. Your name is Dr. Furry. You will provide a single-session consultation to your client following the protocol below. You're helpful, patient, knowledgeable, non-judgmental, and supportive.
            
//             Rules
//             Carefully follow the protocol to conduct a single-session remote veterinary consultation.
//             For each step, gradually guide the user through the process, ask only one question at a time.
//             Decide if it is time to move on to the next step yourself. Be decisive on when to move on to the next step.
//             Your language should be in your client's language.
//             Politely decline client requests that are not part of a veterinary consultation.
//             Summarize what you've learned about the client before proceeding to the next step.
            
//             Protocol
//             Step 1: Introduction
//             Confirm the client's name and relationship to the pet.
//             Ask if it's their first veterinary visit.
//             Step 2: Remote Examining the Pet
//             Guide client on measuring pet's temperature.
//             Provide list of things to check for skin, coat, eyes, ears, nose, mouth, and teeth. Provide options and examples when appropriate.
//             Explain abdomen palpation technique.
//             Step 3: Recent Pet Behaviors
//             Inquire about eating, sleeping, and excretion behaviors. Provide options and examples when appropriate.
//             Step 4: Additional Information from Client
//             Discuss exercise routine, exposure to others, and recent changes. Provide options and examples when appropriate.
//             Step 5: Medical History
//             Ask about the pet's previous illnesses or injuries, including any surgeries or hospitalizations.
//             Inquire about the pet's breed, age, weight, and gender.
//             Ask about the pet's current medications, doses, and schedules.
//             Step 6: Previous Testing/Diagnosis
//             Ask about any diagnostic tests that have been performed, including blood work, imaging studies, or biopsies.
//             Request copies of any test results from other veterinary hospitals or clinics.
//             Step 7: Potential Underlying Causes
//             Describe potential underlying causes for the pet's condition.
//             Explain how symptoms could be related to different underlying causes.
//             Step 8: Explain Test Results
//             Review any test results in detail and explain how they relate to the pet's condition.
//             Describe any abnormalities or deviations from normal ranges. Explain the potential causes for those abnormalities or deviations.
//             Step 9: Suggestions for Diagnosis/Treatment/Care
//             Recommend additional diagnostic tests or procedures that can be performed remotely or by a local vet to help confirm or rule out potential underlying causes.
//             Provide specific treatment recommendations based on the pet's condition and underlying cause.
//             Discuss options for long-term management and care.
//             Step 10: Conclusion
//             Provide a summary of the remote exam findings, diagnostic test results, and treatment plan.
//             After all the previous steps, in case of insufficient information or a serious condition, recommend the client visit a local veterinarian for an in-person examination and treatment.
//             Thank the client for participating in the remote veterinary session.
//             `;
            
//         try {
//             const response = await connectChatGPT(question);
//             if (question && !response) {
//                 console.log("[[[[DEBUG: ChatGptIntent: No response from OpenAI", response, " ]]]]")
//                 return handlerInput.responseBuilder
//                     .speak(requestAttributes.t('NO_RESPONSE'))
//                     .reprompt(requestAttributes.t('CONTINUE_MESSAGE'))
//                     .withShouldEndSession(false)
//                     .getResponse();
//             } else if (question && response) {
//                 const speakOutput = response;
//                 console.log("[[[[DEBUG: ChatGptIntent: Reponse from OpenAI", response, " ]]]]")
                
//                 if (Alexa.getSupportedInterfaces(handlerInput.requestEnvelope)['Alexa.Presentation.APL']) {
//                     datasource.headlineTemplateData.properties.textContent.primaryText.text = "Welcome to Alexa-hosted ChatGPT!"
//                     // generate the APL RenderDocument directive that will be returned from your skill
//                     const aplDirective = createDirectivePayload(DOCUMENT_ID, datasource);
//                     // add the RenderDocument directive to the responseBuilder
//                     handlerInput.responseBuilder.addDirective(aplDirective);
//                 }
                
//                 return handlerInput.responseBuilder
//                     .speak(speakOutput)
//                     .reprompt(requestAttributes.t('CONTINUE_MESSAGE'))
//                     .withShouldEndSession(false)
//                     .getResponse();
//             }
        
//         } catch (error) {
//             console.error("Error while calling OpenAI API: ", error);
//             // Handle error, maybe send a generic response to the user or a prompt to retry
//             return handlerInput.responseBuilder
//                 .speak(requestAttributes.t('OPENAI_ERROR_MESSAGE'))
//                 .reprompt(requestAttributes.t('INFO_MESSAGE'))
//                 .withShouldEndSession(false)
//                 .getResponse();
//         }
//       },
// };

const CancelAndStopIntent = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
        return handlerInput.responseBuilder
            .speak(requestAttributes.t('EXIT_MESSAGE'))
            .getResponse();
    }
};

const SessionEndedRequest = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log(`[[[[ Session ended: ${JSON.stringify(handlerInput.requestEnvelope)} ]]]]]`);
        return handlerInput.responseBuilder.getResponse();
    },
};

const HelpIntent = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' 
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        console.log("Incoming Request: ", JSON.stringify(handlerInput.requestEnvelope));
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();

        return handlerInput.responseBuilder
            .speak(requestAttributes.t('HELP_MESSAGE'))
            .reprompt(requestAttributes.t('HELP_REPROMPT'))
            .getResponse();
  },
};

// const YesIntent = {
//   canHandle(handlerInput) {
//     // only start a new game if yes is said when not playing a game.
//     // let isCurrentlyInChat = false;
//     const { attributesManager } = handlerInput;
//     const sessionAttributes = attributesManager.getSessionAttributes();

//     // if (sessionAttributes.chatState &&
//     //   sessionAttributes.chatState === 'STARTED') {
//     //   isCurrentlyInChat = true;
//     // }

//     return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' 
//       && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.YesIntent';
//   },
//   handle(handlerInput) {
//     console.log("Incoming Request: ", JSON.stringify(handlerInput.requestEnvelope));
//     const { attributesManager } = handlerInput;
//     const requestAttributes = attributesManager.getRequestAttributes();
//     const sessionAttributes = attributesManager.getSessionAttributes();

//     // sessionAttributes.chatState = 'STARTED';

//     return handlerInput.responseBuilder
//       .speak(requestAttributes.t('YES_MESSAGE'))
//       .reprompt(requestAttributes.t('HELP_REPROMPT'))
//       .getResponse();
//   },
// };

// const NoIntent = {
//   canHandle(handlerInput) {
//     // only treat no as an exit when outside a game
//     let isCurrentlyInChat = false;
//     const { attributesManager } = handlerInput;
//     const sessionAttributes = attributesManager.getSessionAttributes();

//     // if (sessionAttributes.chatState &&
//     //   sessionAttributes.chatState === 'STARTED') {
//     //   isCurrentlyInChat = true;
//     // }

//     return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' 
//       && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.NoIntent';
//   },
//   async handle(handlerInput) {
//     const { attributesManager } = handlerInput;
//     const requestAttributes = attributesManager.getRequestAttributes();
//     const sessionAttributes = attributesManager.getSessionAttributes();

//     // sessionAttributes.chatState = 'ENDED';
//     attributesManager.setPersistentAttributes(sessionAttributes);

//     await attributesManager.savePersistentAttributes();

//     return handlerInput.responseBuilder
//       .speak(requestAttributes.t('EXIT_MESSAGE'))
//       .getResponse();

//   },
// };

const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.log(`Error handled: ${error.message}`);
        console.log(`Error stack: ${error.stack}`);
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    
    return handlerInput.responseBuilder
        .speak(requestAttributes.t('ERROR_MESSAGE'))
        .reprompt(requestAttributes.t('ERROR_MESSAGE'))
        .getResponse();
    },
};

const FallbackIntent = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
          && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent');
    },
    handle(handlerInput) {
        console.log("Incoming Request: ", JSON.stringify(handlerInput.requestEnvelope));
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

        return handlerInput.responseBuilder
            .speak(requestAttributes.t('FALLBACK_MESSAGE_OUTSIDE_CHAT'))
            .reprompt(requestAttributes.t('CONTINUE_MESSAGE'))
            .getResponse();
    },
};

const LocalizationInterceptor = {
    process(handlerInput) {
        const localizationClient = i18n.use(sprintf).init({
            lng: Alexa.getLocale(handlerInput.requestEnvelope),
            resources: languageStrings,
        });
        localizationClient.localize = function localize() {
            const args = arguments;
            const values = [];
            for (let i = 1; i < args.length; i += 1) {
                values.push(args[i]);
            }
            const value = i18n.t(args[0], {
                returnObjects: true,
                postProcess: 'sprintf',
                sprintf: values,
            });
            if (Array.isArray(value)) {
                return value[Math.floor(Math.random() * value.length)];
            }
            return value;
        };
        const attributes = handlerInput.attributesManager.getRequestAttributes();
        attributes.t = function translate(...args) {
            return localizationClient.localize(...args);
        };
    },
};


// function getPersistenceAdapter(tableName) {
//   // Determines persistence adapter to be used based on environment
//   // Note: tableName is only used for DynamoDB Persistence Adapter
//   if (process.env.S3_PERSISTENCE_BUCKET) {
//     // in Alexa Hosted Environment
//     // eslint-disable-next-line global-require
//     const s3Adapter = require('ask-sdk-s3-persistence-adapter');
//     return new s3Adapter.S3PersistenceAdapter({
//       bucketName: process.env.S3_PERSISTENCE_BUCKET,
//     });
//   }

//   // Not in Alexa Hosted Environment
//   return new ddbAdapter.DynamoDbPersistenceAdapter({
//     tableName: tableName,
//     createTable: true,
//   });
// }

const skillBuilder = Alexa.SkillBuilders.custom();

exports.handler = skillBuilder
    .addRequestHandlers(
        LaunchRequest,
        ChatGptIntent,
        //PetVetIntent,
        HelpIntent,
        CancelAndStopIntent,
        FallbackIntent,
        SessionEndedRequest
        // YesIntent,
        // NoIntent,
    )
    .addRequestInterceptors(LocalizationInterceptor)
    .addErrorHandlers(ErrorHandler)
    .lambda();