NSB.test = {
  "questions": [
      { "name" : "use",
        "text" : "What's the use?",
        "answers" : [
            { "value" : "retail",
              "text" : "Retail",
              "questions" : [
                { "name" : "retail-type",
                  "text" : "What type of retail?",
                  "answers" : [
                    { "value" : "best",
                      "text" : "the best type of retail",
                      "questions" : [
                        { "name": "good-level",
                          "value" : "good-level",
                          "text" : "How good?",
                          "answers" : [
                            { "value" : "3",
                              "text" : "excellent"
                            },
                            { "value" : "2",
                              "text" : "quite good"
                            },
                            { "value" : "1",
                              "text" : "pretty good"
                            }
                          ]
                        }
                      ]
                    },
                    { "value" : "worst",
                      "text" : "the worst type of retail"
                    }
                  ]
                },
                { "name" : "vod",
                  "text" : "Vacant+Open+Dangerous?",
                  "answers" : [
                    { "value" : "1",
                      "text" : "yes"
                    },
                    {
                      "value" : "0",
                      "text" : "no"
                    }
                  ]
                }
              ]
            },
            { "value" : "service",
              "text" : "Service",
              "questions" : [
                { "name" : "service-type",
                  "text" : "What type of service?",
                  "answers" : [
                    { "value" : "dry-cleaner",
                      "text" : "A Dry Cleaner, yo!"
                    },
                    { "value" : "other",
                      "text" : "Other Service"
                    }
                  ]
                }
              ]
            },
            { "value" : "storage",
              "text" : "Storage"
            }
        ]
      }
  ]
};
