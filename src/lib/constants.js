// constants.js
// All shared constant data: colours, pitch defaults, team defaults, test data.
// This file depends on NOTHING else - it is the foundation.

export const APP_MODE = "development";
// "development" | "production"
export const G="#1A5C38",AU="#C9A84C",GD="#E8F5EE",WH="#ffffff",LG="#F4F7F5";
export const RE="#C0392B",AM="#E67E22",BL="#1565C0",TE="#00796B",PU="#6A1B9A";
export const DEFAULT_BUFFER_YOUTH=15,DEFAULT_BUFFER_ADULT=30;
export const CAR_PARK_CAPACITY=57;

export const DEFAULT_CLUB = {
  name: "Horwich St Mary's FC",
  venue: "Scholes Bank, Horwich",
  postcode: "BL6 7QE",
  weatherPostcode: "BL6 7QE",
  primarySiteId: "scholes-bank",
  sites: [
    {
      id: "scholes-bank",
      name: "Scholes Bank",
      venue: "Scholes Bank, Horwich",
      postcode: "BL6 7QE",
      isPrimary: true,
      carParkSpaces: 57,
      notes: "Primary matchday site",
    },
  ],
  primary: "#1A5C38",
  secondary: "#C9A84C",
  sport: "Football",
  logo: "",
  carParkSpaces: 57,
  maxConcurrent: 3,
  avgCars: {"3v3":8,"5v5":12,"7v7":16,"9v9":20,"11v11-youth":28,"11v11-small":28,"11v11":36},
};

export const AVG_CARS={"3v3":8,"5v5":12,"7v7":16,"9v9":20,"11v11-youth":28,"11v11-small":28,"11v11":36};

// Legacy mini age keywords kept here while older forms/scheduler imports are consolidated.
export const MINI_KW=["u7","u8","u9","u10"];

export {
  DEFAULT_PITCHES as PITCHES,
  FORMAT_PITCH_OPTIONS as FORMAT_COMPAT,
  MINI_FORMATS,
  getPitchConflictMap,
  getInnerPitchIds,
  getIndependentPitchIds,
} from "./registry/pitchRegistry.js";

export const PITCH_CONFLICTS={P1a:"P1",P2a:"P2",P3a:"P3"};
export const INNER_PITCHES=["P1a","P2a","P3a"];
export const INDEPENDENT_PITCHES=["3v3","AST"];

export const TEAM_CONFIG_DEFAULT=[
  {name:"U7",teamType:"youth",format:"3v3",defaultPitch:"3v3",altPitch:null,ageOrder:1,day:"Saturday",gameMins:40},
  {name:"U8 Lions",teamType:"youth",format:"5v5",defaultPitch:"P5",altPitch:null,ageOrder:2,day:"Saturday",gameMins:40},
  {name:"U8 Sharks",teamType:"youth",format:"5v5",defaultPitch:"P5",altPitch:null,ageOrder:2,day:"Saturday",gameMins:40},
  {name:"U8 Dynamos",teamType:"youth",format:"5v5",defaultPitch:"P5",altPitch:null,ageOrder:2,day:"Saturday",gameMins:40},
  {name:"U9 Dragons",teamType:"youth",format:"5v5",defaultPitch:"P5",altPitch:null,ageOrder:3,day:"Saturday",gameMins:40},
  {name:"U10 Avengers",teamType:"youth",format:"7v7",defaultPitch:"P5",altPitch:"P3a",ageOrder:4,day:"Saturday",gameMins:50},
  {name:"U10 Cobras",teamType:"youth",format:"7v7",defaultPitch:"P2a",altPitch:"P3a",ageOrder:4,day:"Saturday",gameMins:50},
  {name:"U10 Wanderers",teamType:"youth",format:"7v7",defaultPitch:"P3a",altPitch:"P5",ageOrder:4,day:"Saturday",gameMins:50},
  {name:"U12 Eagles",teamType:"youth",format:"9v9",defaultPitch:"P3",altPitch:"P1a",ageOrder:5,day:"Saturday",gameMins:60},
  {name:"U12 Raptors",teamType:"youth",format:"9v9",defaultPitch:"P1a",altPitch:"P3",ageOrder:5,day:"Saturday",gameMins:60},
  {name:"U12 Rockets",teamType:"youth",format:"9v9",defaultPitch:"P3",altPitch:"P1a",ageOrder:5,day:"Saturday",gameMins:60},
  {name:"U12 Tornadoes",teamType:"youth",format:"9v9",defaultPitch:"P1a",altPitch:"P3",ageOrder:5,day:"Saturday",gameMins:60},
  {name:"U13 Locomotives",teamType:"youth",format:"9v9",defaultPitch:"P3",altPitch:"P1a",ageOrder:6,day:"Saturday",gameMins:60},
  {name:"U13 Vulcans",teamType:"youth",format:"9v9",defaultPitch:"P1a",altPitch:"P3",ageOrder:6,day:"Saturday",gameMins:60},
  {name:"U14 Lightning",teamType:"youth",format:"11v11-youth",defaultPitch:"P4",altPitch:"P2",ageOrder:7,day:"Saturday",gameMins:70},
  {name:"U14 Spartans",teamType:"youth",format:"11v11-youth",defaultPitch:"P4",altPitch:"P2",ageOrder:7,day:"Saturday",gameMins:70},
  {name:"U15 Crusaders",teamType:"youth",format:"11v11-youth",defaultPitch:"P4",altPitch:"P2",ageOrder:8,day:"Saturday",gameMins:70},
  {name:"U15 Knights",teamType:"youth",format:"11v11-youth",defaultPitch:"P2",altPitch:"P4",ageOrder:8,day:"Saturday",gameMins:70},
  {name:"U15 Vikings",teamType:"youth",format:"11v11-youth",defaultPitch:"P4",altPitch:"P2",ageOrder:8,day:"Saturday",gameMins:70},
  {name:"U15 Lionesses",teamType:"youth",format:"11v11-youth",defaultPitch:"P2",altPitch:"P4",ageOrder:8,day:"Sunday",gameMins:70},
  {name:"U16 Cheetahs",teamType:"youth",format:"11v11-youth",defaultPitch:"P4",altPitch:"P2",ageOrder:9,day:"Saturday",gameMins:80},
  {name:"U16 Bears",teamType:"youth",format:"11v11-youth",defaultPitch:"P2",altPitch:"P4",ageOrder:9,day:"Saturday",gameMins:80},
  {name:"U17 Lisbon",teamType:"youth",format:"11v11-youth",defaultPitch:"P4",altPitch:"P2",ageOrder:10,day:"Saturday",gameMins:80},
  {name:"HSM 1st Team",teamType:"adult",format:"11v11",defaultPitch:"P1",altPitch:"P2",ageOrder:11,day:"Saturday",gameMins:90},
  {name:"HSM Reserves",teamType:"adult",format:"11v11",defaultPitch:"P2",altPitch:"P1",ageOrder:11,day:"Saturday",gameMins:90},
  {name:"HSM Sunday 1sts",teamType:"adult",format:"11v11",defaultPitch:"P1",altPitch:"P2",ageOrder:11,day:"Sunday",gameMins:90},];

export const TEST_SAT=[
  {homeTeam:"Horwich St Marys U7",awayTeam:"Farnworth Town U7",league:"BBDFL",isCup:false,status:"active",referee:"",refPhone:"",refStatus:"TBC"},
  {homeTeam:"Horwich St Marys U8 Lions",awayTeam:"Westhoughton U8",league:"BBDFL",isCup:false,status:"active",referee:"",refPhone:"",refStatus:"TBC"},
  {homeTeam:"Horwich St Marys U9 Dragons",awayTeam:"Leigh Rangers U9",league:"BBDFL",isCup:false,status:"active",referee:"",refPhone:"",refStatus:"TBC"},
  {homeTeam:"Horwich St Marys U10 Avengers",awayTeam:"Atherton U10",league:"BBDFL",isCup:false,status:"active",referee:"",refPhone:"",refStatus:"TBC"},
  {homeTeam:"Horwich St Marys U10 Cobras",awayTeam:"Bury AFC U10",league:"BBDFL",isCup:false,status:"active",referee:"",refPhone:"",refStatus:"TBC"},
  {homeTeam:"Horwich St Marys U12 Eagles",awayTeam:"Bolton Wanderers U12",league:"BBDFL",isCup:false,status:"active",referee:"J. Smith",refPhone:"07700 900123",refStatus:"Confirmed"},
  {homeTeam:"Horwich St Marys U12 Raptors",awayTeam:"Radcliffe FC U12",league:"BBDFL",isCup:true,status:"active",referee:"P. Jones",refPhone:"07700 900456",refStatus:"Awaiting"},
  {homeTeam:"Horwich St Marys U13 Locomotives",awayTeam:"Leigh Rangers U13",league:"BBDFL",isCup:false,status:"active",referee:"M. Brown",refPhone:"07700 900789",refStatus:"Confirmed"},
  {homeTeam:"Horwich St Marys U14 Lightning",awayTeam:"Salford City U14",league:"BBDFL",isCup:false,status:"active",referee:"",refPhone:"",refStatus:"TBC"},
  {homeTeam:"Horwich St Marys U16 Bears",awayTeam:"Rochdale AFC U16",league:"BBDFL",isCup:false,status:"active",referee:"D. Wilson",refPhone:"07700 900321",refStatus:"Confirmed"},
  {homeTeam:"Horwich St Marys HSM 1st Team",awayTeam:"Eagley FC",league:"LAL",isCup:false,status:"active",referee:"R. Taylor",refPhone:"07700 900654",refStatus:"Confirmed"},
];

export const TEST_SUN=[
  {homeTeam:"Horwich St Marys U15 Lionesses",awayTeam:"Oldham Athletic U15",league:"WDYFL",isCup:false,status:"active",referee:"K. Davies",refPhone:"07700 900888",refStatus:"Confirmed"},
  {homeTeam:"Horwich St Marys HSM Sunday 1sts",awayTeam:"Salford Victoria",league:"SLC",isCup:false,status:"active",referee:"",refPhone:"",refStatus:"TBC"},
];

export const FA_LEAGUES=[
  {id:"BBDFL",name:"Bolton, Bury and District FL",url:"https://fulltime.thefa.com/fixtures.html?selectedSeason=467452772&selectedFixtureGroupAgeGroup=0&selectedFixtureGroupKey=&selectedDateCode=all&selectedClub=608702885&selectedTeam=&selectedRelatedFixtureOption=3&selectedFixtureDateStatus=&selectedFixtureStatus=&previousSelectedFixtureGroupAgeGroup=&previousSelectedFixtureGroupKey=&previousSelectedClub=608702885&itemsPerPage=25"},
  {id:"LAL",name:"Lancashire Amateur League",url:"https://fulltime.thefa.com/fixtures.html?selectedSeason=219056685&selectedFixtureGroupKey=&selectedDateCode=all&selectedClub=358794991&selectedTeam=&selectedRelatedFixtureOption=3&selectedFixtureDateStatus=&selectedFixtureStatus=&previousSelectedFixtureGroupAgeGroup=&previousSelectedFixtureGroupKey=&previousSelectedClub=&itemsPerPage=25"},
  {id:"WDYFL",name:"Wigan and District Youth FL",url:"https://fulltime.thefa.com/fixtures.html?selectedSeason=236124694&selectedFixtureGroupAgeGroup=0&selectedFixtureGroupKey=&selectedDateCode=all&selectedClub=8646008&selectedTeam=&selectedRelatedFixtureOption=2&selectedFixtureDateStatus=&selectedFixtureStatus=&previousSelectedFixtureGroupAgeGroup=&previousSelectedFixtureGroupKey=&previousSelectedClub=&itemsPerPage=25"},
  {id:"SLC",name:"South Lancs Counties League",url:"https://fulltime.thefa.com/fixtures.html?selectedSeason=614969999&selectedFixtureGroupKey=&selectedDateCode=all&selectedClub=734633761&selectedTeam=&selectedRelatedFixtureOption=3&selectedFixtureDateStatus=&selectedFixtureStatus=&previousSelectedFixtureGroupAgeGroup=&previousSelectedFixtureGroupKey=&previousSelectedClub=&itemsPerPage=25"},
];