NSB.test = {
  "questions": [
    {
      "name": "structure",
      "text": "Is there a structure on the site?",
      "answers": [
        {
          "value": "yes",
          "text": "Yes",
          "questions": [
            {
              "name": "structure-properties",
              "text": "Do any of the following apply?",
              "type": "checkbox",
              "answers": [
                {
                  "name": "under-construction",
                  "value": "yes",
                  "text": "Property is under construction"
                },
                {
                  "name": "fire-damage",
                  "value": "yes",
                  "text": "The structure appears to be fire-damaged"
                },
                {
                  "name": "vod",
                  "value": "yes",
                  "text": "The structure appears to be vacant, open, and dangerous"
                },
                {
                  "name": "boarding-needed",
                  "value": "yes",
                  "text": "The structure needs to be boarded"
                },
                {
                  "name": "grass-needs-cut",
                  "value": "yes",
                  "text": "The grass needs to be cut"
                },
                {
                  "name": "dumping",
                  "value": "yes",
                  "text": "The lot needs to be cleared of dumped materials or debris piles"
                }
              ]
            },
            
            
            {
              "name": "use",
              "text": "What is the structure's use type?",
              "answers": [
                {
                  "value": "residential",
                  "text": "Residential",
                  "questions": [
                    {
                      "name": "units",
                      "text": "How many units does this residential structure appear to have?",
                      "answers": [
                        {
                          "value": "1",
                          "text": "1 unit"
                        },
                        {
                          "value": "2",
                          "text": "2 units"
                        },
                        {
                          "value": "3-4",
                          "text": "3-4 units"
                        },
                        {
                          "value": "5-10",
                          "text": "5-10 units"
                        },
                        {
                          "value": "10+",
                          "text": "More than 10 units"
                        }
                      ]
                    },
                    {
                      "name": "occupancy",
                      "text": "What is the building's occupancy status?",
                      "answers": [
                        {
                          "value": "Occupied",
                          "text": "Occupied"
                        },
                        {
                          "value": "Likely occupied",
                          "text": "Likely occupied"
                        },
                        {
                          "value": "Unknown",
                          "text": "Unknown"
                        },
                        {
                          "value": "Likely vacancy",
                          "text": "Likely vacancy"
                        },
                        {
                          "value": "Vacant",
                          "text": "Vacant"
                        }
                      ]
                    }
                    
                  ]
                },
                {
                  "value": "commercial",
                  "text": "Commercial",
                  "questions": [
                    {
                      "name": "storefront-condition",
                      "text": "What is the general condition of the storefront and/or lot?",
                      "type": "checkbox",
                      "answers": [
                        {
                          "name": "signage-attractive",
                          "value": "yes",
                          "text": "Attractive"
                        },
                        {
                          "name": "signage-clear",
                          "value": "yes",
                          "text": "Signage is clear and inviting"
                        },
                        {
                          "name": "signage-needs-work",
                          "value": "yes",
                          "text": "Needs minimal work"
                        },
                        {
                          "name": "signage-needs-attention",
                          "value": "yes",
                          "text": "Needs serious attention to make attractive and inviting"
                        }                
                      ]
                    },
                    {
                      "name": "commercial-units",
                      "text": "Approximately how many commercial units are in the building?",
                      "answers": [
                        {
                          "value": "1",
                          "text": "Only one"
                        },
                        {
                          "value": "2-3",
                          "text": "2-3"
                        },
                        {
                          "value": "4+",
                          "text": "4 or more"
                        }
                      ]
                    },
                    {
                      "name": "commercial-use",
                      "text": "What is the primary type of active commercial found in the building?",
                      "type": "checkbox",
                      "multiple": "true",
                      "answers": [
                        {
                          "name": "use-office",
                          "value": "use-office",
                          "text": "Office Building"
                        },
                        {
                          "name": "use-grocery",
                          "value": "use-grocery",
                          "text": "Grocery",
                          "questions": [
                            {
                              "name": "use-grocery-detail",
                              "text": "Detailed grocery use",
                              "type": "checkbox",
                              "answers": [
                                {
                                  "name": "grocery-full-service",
                                  "value": "yes",
                                  "text": "Full service grocery"
                                },
                                {
                                  "name": "grocery-quick",
                                  "value": "yes",
                                  "text": "Quick marty"
                                }                                
                              ]
                            }
                          ]
                          
                        },
                        {
                          "name": "use-retail",
                          "value": "use-retail",
                          "text": "Other Retail"
                        },
                        {
                          "name": "use-services",
                          "value": "use-services",
                          "text": "Services"
                        },
                        {
                          "name": "use-entertainment",
                          "value": "use-entertainment",
                          "text": "Entertainment"
                        },
                        {
                          "name": "use-food",
                          "value": "use-food",
                          "text": "Food"
                        },
        
                      ]
                    },
                    {
                      "name": "asset-close",
                      "value": "asset-close",
                      "text": "Is the property in close proximity to any major community assets?",
                      "type": "text",
                      "answers": [
                        {
                          "name": "nearby-asset",
                          "value": "",
                          "text": "What is the name of the community asset?"
                        }
                      ]
                    }
                    
                  ]
                },
                
                
                {
                  "value": "industrial",
                  "text": "Industrial",
                  "questions": [
                    {
                      "name": "industrial-detailed-use",
                      "text": "What is the detailed use type?",
                      "answers": [
                        {
                          "value": "automotive",
                          "text": "Automotive"
                        },
                        {
                          "value": "heavy",
                          "text": "Heavy industrial"
                        },
                        {
                          "value": "light",
                          "text": "Light industrial"
                        }
                      ]
                    }
                  ]
                },
                {
                  "name": "other-use",
                  "value": "other-use",
                  "text": "Institutional, recreational, or other use",
                  "questions": [
                    {
                      "name": "detailed-use",
                      "text": "Detailed use:",
                      "answers": [
                        {
                          "value": "governmental",
                          "text": "Governmental"
                        },
                        {
                          "value": "educational",
                          "text": "Educational"
                        },
                        {
                          "value": "hospital",
                          "text": "Hospital"
                        },
                        {
                          "value": "religious",
                          "text": "Religious"
                        },
                        {
                          "value": "infrastructure",
                          "text": "Infrastructure / City services"
                        },
                        {
                          "value": "park",
                          "text": "Park with park structure"
                        },
                        {
                          "value": "other",
                          "text": "Other"
                        }
                      ]
                    }
                  ]
                } 
              ]
            },
            
            
            {
              "name": "condition",
              "text": "What is the general condition of the structure?",
              "answers": [
                {
                  "value": "excellent",
                  "text": "Excellent"
                },
                {
                  "value": "good",
                  "text": "Good"
                },
                {
                  "value": "fair",
                  "text": "Fair"
                },
                {
                  "value": "poor",
                  "text": "Poor"
                },
                {
                  "value": "needs-demolition",
                  "text": "Needs demolition"
                }
              ]
            },
            
            
            {
              "name": "in-use",
              "text": "Does the structure appear to be in use?",
              "answers": [
                {
                  "value": "yes",
                  "text": "Yes"
                },
                {
                  "value": "unknown",
                  "text": "Unknown"
                },
                {
                  "value": "no",
                  "text": "No"
                }
              ]
            }
          ]
        },
        {
          "value": "no",
          "text": "No",
          "questions": [
            {
              "name": "no-structure",
              "text": "Are any of the following true?",
              "type": "checkbox",
              "answers": [
                {
                  "name": "unmaintained",
                  "value":"yes",
                  "text": "Unmaintained site"
                },
                {
                  "name": "dumping",
                  "value":"yes",
                  "text": "Illegal dumping on site"
                },
                {
                  "name": "parking-or-storage",
                  "value":"yes",
                  "text": "Parking or storage on site"
                },
                {
                  "name": "park",
                  "value":"yes",
                  "text": "Site is a park"
                }       
              ]
            }
          ]
        }
      ]
    }
  ]
}

//NSB.test = {
//  "questions": [
//      { "name" : "site",
//        "text" : "What's on the site?",
//        "answers" : [
//            { 
//              "value" : "single-building",
//              "text" : "One building"
//            },
//            { 
//              "value" : "multiple-buildings",
//              "text" : "Multiple Buildings"
//            },
//            { 
//              "value" : "parking",
//              "text" : "A parking lot"
//            },
//            { 
//              "value" : "A park",
//              "text" : "An empty lot",
//              "questions": [
//                {
//                  "name": "lot",
//                  "text": "What kind of lot is it?",
//                  "answers": [
//                    {
//                      "value": "unimproved",
//                      "text": "Unimproved (no paving or structures)"
//                    },
//                    {
//                      "value": "improved",
//                      "text": "Improved (paving or structures)"
//                    },
//                    {
//                      "value": "sidelot",
//                      "text": "A fenced side lot"
//                    }
//                  ]
//                }
//              ]
//            }
//        ]
//      }, // End site
//      
//     // { 
//     //   "name" : "use",
//     //   "text" : "What is the property used for",
//     //   "answers": [
//     //     {
//     //       "value": "retail",
//     //       "text": "Retail"
//     //     },
//     //     {
//     //       "value": "service",
//     //       "text": "Service"
//     //     },
//     //     {
//     //       "value": "restaurant",
//     //       "text": "Restaurant or Bar"
//     //     },
//     //     {
//     //       "value": "office",
//     //       "text": "Office"
//     //     },
//     //     {
//     //       "value": "industrial",
//     //       "text": "Industrial"
//     //     },
//     //     {
//     //       "value": "religious",
//     //       "text": "Religious"
//     //     },
//     //     {
//     //       "value": "unknown",
//     //       "text": "Unknown"
//     //     }
//     //   ]
//     // },
//      
//      { 
//        "name": "occupancy",
//        "text": "Is it occupied?",
//        "answers": [
//          {
//            "value": "occupied",
//            "text": "Occupied"
//          },
//          {
//            "value": "probably-occupied",
//            "text": "Probably occupied"
//          },
//          {
//            "value": "probably-vacant",
//            "text": "Probably vacant"
//          },
//          {
//            "value": "vacant-abandoned",
//            "text": "Vacant, abandoned"
//          }
//        ]
//      },      
//      
//      {
//        "name": "condition",
//        "text": "What condition is it in?",
//        "answers": [
//          {
//            "value": "good",
//            "text": "Good"
//          },
//          {
//            "value": "fair",
//            "text": "Fair"
//          },
//          {
//            "value": "poor",
//            "text": "Poor"
//          },
//          {
//            "value": "demolish",
//            "text": "Demolish"
//          }
//        ]
//      }, // end condition
//      
//      {
//        "name": "fire",
//        "text": "Fire Damage",
//        "answers": [
//          {
//            "value": "no fire damage",
//            "text": "No fire damage"
//          },
//          {
//            "value": "some fire damage",
//            "text": "Some fire damage"
//          },
//          {
//            "value": "heavy fire damage",
//            "text": "Heavy fire damage (burnt out wall or roof)"
//          }
//        ]
//      },
//      
//      {
//        "name": "boarded",
//        "text": "",
//        "answers": [
//          {
//            "value": "boarded up",
//            "text": "Is the property fully boarded up?"
//          }
//        ]
//      },
//      
//      {
//        "name": "lawn",
//        "text": "",
//        "answers": [
//          {
//            "value": "unkept lawn",
//            "text": "Does the lawn need substantial mowing or clearing?"
//          }
//        ]
//      },
//      
//
//      {
//        "name": "vod",
//        "text": "",
//        "answers": [
//          {
//            "value": "vod",
//            "text": "Vacant, open, and dangerous"
//          }
//        ]
//      } // end vod
//  ]
//};
//