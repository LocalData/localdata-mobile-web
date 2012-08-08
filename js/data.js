NSB.test = {
  "questions": [
      { "name" : "site",
        "text" : "What's on the site?",
        "answers" : [
            { 
              "value" : "single-building",
              "text" : "One building"
              //"questions" : [
              //  { "name" : "retail-type",
              //    "text" : "What type of retail?",
              //    "answers" : [
              //      { "value" : "best",
              //        "text" : "the best type of retail",
              //        "questions" : [
              //          { "name": "good-level",
              //            "value" : "good-level",
              //            "text" : "How good?",
              //            "answers" : [
              //              { "value" : "3",
              //                "text" : "excellent"
              //              },
              //              { "value" : "2",
              //                "text" : "quite good"
              //              },
              //              { "value" : "1",
              //                "text" : "pretty good"
              //              }
              //            ]
              //          }
              //        ]
              //      },
              //      { "value" : "worst",
              //        "text" : "the worst type of retail"
              //      }
              //    ]
              //  }
              //]
            },
            { 
              "name" : "multiple-buildings",
              "text" : "Multiple Buildings"
            },
            { 
              "name" : "parking",
              "text" : "A parking lot"
            },
            { 
              "name" : "A park",
              "text" : "An empty lot"
            }
        ]
      }, // End use
      
      { "name" : "use",
        "text" : "What is the property used for",
        "answers": [
          {
            "value": "retail",
            "text": "Retail"
          },
          {
            "value": "service",
            "text": "Service"
          },
          {
            "value": "restaurant",
            "text": "Restaurant or Bar"
          },
          {
            "value": "office",
            "text": "Office"
          },
          {
            "value": "industrial",
            "text": "Industrial"
          },
          {
            "value": "religious",
            "text": "Religious"
          },
          {
            "value": "unknown",
            "text": "Unknown"
          }
        ]
      },
      
      { "name": "occupancy",
        "text": "Is it occupied?",
        "answers": [
          {
            "name": "occupied",
            "text": "Occupied"
          },
          {
            "name": "probably-occupied",
            "text": "Probably occupied"
          },
          {
            "name": "probably-vacant",
            "text": "Probably vacant"
          },
          {
            "name": "vacant-abandoned",
            "text": "Vacant, abandoned"
          }
        ]
      },
      
      {
        "name": "condition",
        "text": "What condition is it in?",
        "answers": [
          {
            "name": "good",
            "text": "Good"
          },
          {
            "name": "fair",
            "text": "Fair"
          },
          {
            "name": "poor",
            "text": "Poor"
          },
          {
            "name": "demolish",
            "text": "Demolish"
          }
        ]
      }, // end condition
      
      {
        "name": "",
        "text": "",
        "answers": [
          {
            "name": "vod",
            "text": "Vacant, open, and dangerous"
          }
        ]
      } // end vod
      
      
      
  ]
};
