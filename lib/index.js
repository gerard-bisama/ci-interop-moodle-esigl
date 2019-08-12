#!/usr/bin/env node
'use strict'

const express = require('express')
const medUtils = require('openhim-mediator-utils')
const winston = require('winston')
const syncAPI=require('./lib.js');
const utils = require('./utils');
var moodleStructureAPI =require ("./dataObjectStructure.js");
var btoa = require('btoa');
const SENDEMAIL = require('./email')

//customized variable
var User=moodleStructureAPI.User;
var Course=moodleStructureAPI.Course;
var CourseCategory=moodleStructureAPI.CourseCategory;

// Logging setup
winston.remove(winston.transports.Console)
winston.add(winston.transports.Console, {level: 'info', timestamp: true, colorize: true})

// Config
var config = {} // this will vary depending on whats set in openhim-core
const apiConf = process.env.NODE_ENV === 'test' ? require('../config/test') : require('../config/config')
const mediatorConfig = require('../config/mediator')

var port = process.env.NODE_ENV === 'test' ? 7002 : mediatorConfig.endpoints[0].port

/**
 * setupApp - configures the http server for this mediator
 *
 * @return {express.App}  the configured http server
 */
 function errorHandler(err, req, res, next) {
		  if (res.headersSent) {
			return next(err);
		  }
		  res.status(500);
		  res.render('error', { error: err });
	}
/**
 * User global variable sections
 * */
//console.log(config);
//const wsMoodleURL=config.moodleParams.url+config.moodleParams.apiPath+config.moodleParams.token;
//const lmisV2RootUrl=config.esiglServer.url+config.esiglServer.resourcespath;
//const basicAuthAccessOpenLMISV2 = `Basic ${btoa(config.esiglServer.username+':'+config.esiglServer.password)}`;
//const pgConnectionString=config.pgConnectionString;
//var listUsersToExclude=config.usernameToExclude.split(",");
function setupApp () {
	
  const app = express()
  app.use(errorHandler);
  var async = require('async');
  //var btoa = require('btoa');
  
    
	app.get('/pushmoodle2lmis', (req, res) => {
		/*var needle = require('needle');
		needle.defaults(
		{
			open_timeout: 600000
		});*/
		//console.log("Entered ....!");
		winston.info("Start Moodle=>eSGL products sync...!");
		//const basicLMISToken = `Basic ${btoa(mediatorConfig.config.esiglServer.username+':'+mediatorConfig.config.esiglServer.password)}`;
		//Get Product list from hapi
		var _listUserAndAssociatedCourse=[];
		var _listFacilitiesAndAssociatedUsers=[];
		var _listRoles=[];
		var orchestrations=[];
		const pgConnectionString=config.pgConnectionString;
		async.each([1,2,3],function(index,callback)
		{
			if(index==1)
			{
				//console.log("Entered "+index);
				getListMoodleCoursesAndUsers(function(listUserAndAssociatedCourse)
				{
					_listUserAndAssociatedCourse=listUserAndAssociatedCourse;
					//console.log(_listUserAndAssociatedCourse);
					callback();
				});
			}
			
			if(index==2)
			{
				
				getListLMISFacilitiesAndAssociatedUsersV2(function(listFacilitiesAndAssociatedUsers)
				{
					//winston.info("returned the list!!!!!");
					//console.log(listFacilitiesAndAssociatedUsers);
					_listFacilitiesAndAssociatedUsers=listFacilitiesAndAssociatedUsers;
					callback();
				});
				//callback();
			}
			if(index==3)
			{
				//console.log("Entered "+index);
				getLMISRolesV2(function(listRoles)
				{
					_listRoles=listRoles;
					callback();
				});
			}
		},function(err)
		{
			if(err)
			{
				winston.err(err);
			}
			winston.info("----Resolved _listUsersAndAssociatedCourse,listFacilitiesAndAssociatedUsers,listRoles------");
			//console.log(_listRoles);
			//console.log("----------------------------------");
			//console.log(listUserAndAssociatedCourse);
			winston.info("ListUsers and associated courses:"+_listUserAndAssociatedCourse.length);
			if(_listUserAndAssociatedCourse.length>0)
			{
				var listUsersToCreateInLmis=[];
				for(var indexUser=0;indexUser<_listUserAndAssociatedCourse.length;indexUser++)
				{
					var usernameToFind=_listUserAndAssociatedCourse[indexUser].username;
					var userIsAlreadyInLmis=false;
					var userFound=null;
					//for each facility check if the user  
					for(var indexFacility=0;indexFacility<_listFacilitiesAndAssociatedUsers.length; indexFacility++)
					{
						var listUsersInFacility=[];
						if(_listFacilitiesAndAssociatedUsers[indexFacility].users.length>0)
						{
							listUsersInFacility=getLmisUsersFromFacility(_listFacilitiesAndAssociatedUsers[indexFacility].id,_listFacilitiesAndAssociatedUsers);
							userFound=getLmisUsersWithUsername(usernameToFind,listUsersInFacility);
							if(userFound!=null)//if user already created in openlmis,stop all process and pass to the next user
							{
								//continue;
								userIsAlreadyInLmis=true;
								break;
							}
						}
						else
						{
							continue;
						}
					}//end for _listFacilitiesAndAssociatedCourse
					if(userIsAlreadyInLmis)
					{
						continue; //continue to the next user.This user could be created
					}
					else//this user shoud be created in openlmis
					{
						listUsersToCreateInLmis.push(_listUserAndAssociatedCourse[indexUser]);
					}
					
				}//End for _listUserAndAssociatedCourse
				var nbrOfUserToAddInLMIS=listUsersToCreateInLmis.length;
				winston.info("List user to create in LMIS:"+nbrOfUserToAddInLMIS);
				if(nbrOfUserToAddInLMIS>0)
				{
					//limit the number of user to create to 20 every calls to avoid max_connection limit fixed to 100
					var maxUsersToSyncPerCall=parseInt(config.maxUsersToSyncPerCall);
					var sortedListUsersToCreateInLMIS=sortListUsersById(listUsersToCreateInLmis);
					//var finalListUserToCreateInLMIS=sortedListUsersToCreateInLMIS.slice(0,maxUsersToSyncPerCall);
					var finalListUserToCreateInLMIS=sortedListUsersToCreateInLMIS;
					//console.log(finalListUserToCreateInLMIS);
					//return;
					var listLmisUserToCreate=[];
					//Get the sorted list of first 100 facilities,limit 100 due to the max_connection params configured in postgres openlmis
					var listSortedFacility=sortListFacilityByNbrUserAndName(_listFacilitiesAndAssociatedUsers.slice(0,100));
					var listSortedFacilityToAdd=listSortedFacility.slice(0,maxUsersToSyncPerCall);
					//console.log(listSortedFacilityToAdd);
					//return;
					for(var indexUser=0;indexUser<finalListUserToCreateInLMIS.length;indexUser++)
					{
						//Generate random index for listHomeFacility
						var indexHomeFacilities=Math.floor(Math.random() * listSortedFacilityToAdd.length);
						var homeFacilityId=listSortedFacility[indexHomeFacilities].id;
						var listRoleAssigned=[];
						//list roles and associated programs defined by default in manifest file
						var listRoleAndProgramsRules=syncAPI.getlmisUserRolesAndProgramRules(config.lmisUserCreationRolesAndProgramRules);
						//the role is returned as course categoryid
						//var listRoleFromMoodleUser=getListRolesFromMoodleUser(finalListUserToCreateInLMIS[indexUser].id,finalListUserToCreateInLMIS);
						//console.log(listRoleAndProgramsRules);
						//console.log("-----------------------");
						for(var indexRule=0;indexRule<listRoleAndProgramsRules.length;indexRule++)
						{
							var oRoleProgramRule=listRoleAndProgramsRules[indexRule];
							var oRole=getRoleByName(oRoleProgramRule.role,_listRoles);
							var oRoleToAssign={roleId:oRole.id,programId:oRoleProgramRule.program_wharehouse};
							listRoleAssigned.push(oRoleToAssign);
							
						}//end for listRoleAndProgramsRules
						if(finalListUserToCreateInLMIS[indexUser].username!="")
						{
							var passwordPart2=Math.floor(Math.random() * 10000)+9000;
							var _password="Moodle!"+passwordPart2;
							var lmisUser={id:finalListUserToCreateInLMIS[indexUser].id,username:finalListUserToCreateInLMIS[indexUser].username,password:_password,firstName:finalListUserToCreateInLMIS[indexUser].firstname,
							lastName:finalListUserToCreateInLMIS[indexUser].lastname,email:finalListUserToCreateInLMIS[indexUser].email,active:true,loginRestricted:false,
							homeFacilityId:homeFacilityId,
							roleAssignments:listRoleAssigned};
							listLmisUserToCreate.push(lmisUser);
						}
					}//end for listUsersToCreateInLmis
					//console.log(finalListUserToCreateInLMIS);
					var async = require("async");
					var listResultUsersCreated=[];
					async.each(listLmisUserToCreate,function(userToCreate,callback)
					{
						
						syncAPI.createLMISUserLMISV2Sync(pgConnectionString,userToCreate,function(res)
						{
							if(res)
							{
								winston.info(userToCreate.username+" created in eSIGL");
								listResultUsersCreated.push(userToCreate);
							}
							else
							{
								winston.warn("Error:"+userToCreate.username+" not created in eSIGL!!");
							}
							callback();
						});
						
						
						//listResultUsersCreated.push(userToCreate);
						//callback();
						
					},function(err)
					{
						if(err)
						{
							winston.err("Error Create user"+err);
						}
						winston.info("Create LMIS users done!!!");
						var emailSettings=config.emailSettings;
						var emailTitle=config.emailStructure.title;
						var esigleSite=config.esiglServer.url;
						var async = require("async");
						async.each(listResultUsersCreated,function(resultUser,callback)
						{
							//var email=resultUser.email;
							var email="gerbis2000@gmail.com";
							var username=resultUser.username;
							var password=resultUser.password;
							var messageContent=config.emailStructure.messageContent;
							messageContent= messageContent.replace("{esigleSite}",esigleSite);
							messageContent=messageContent.replace("{username}",username);
							messageContent=messageContent.replace("{password}",password);
							var destination=[email];
							SENDEMAIL.sendEmail(emailTitle,messageContent,destination,emailSettings,()=>{
								winston.info("Email sent!");
							})
							callback();
						},function(err)
						{
							if(err)
							{
								winston.err("Error: "+err);
							}
							//Then log the account in the mongodb
							var currentDate=new Date().toJSON().split("T")[0];
							console.log(listResultUsersCreated);
							syncAPI.saveAllSynchedUsers(currentDate,listResultUsersCreated,function(resLog)
							{
								winston.info(resLog);
							})
							var urn = mediatorConfig.urn;
							var status = 'Successful';
							var response = {
							  status: 200,
							  headers: {
								'content-type': 'application/json'
							  },
							  body:JSON.stringify( {'userSynchedOperation':'success'}),
							  timestamp: new Date().getTime
							};
							var orchestrationsResultsSyncUsers=[{
								name: "push Moodle=>eSIGL",
								request: {
								  path : mediatorConfig.defaultChannelConfig[0].routes[0].path,
								  headers: {'Content-Type': 'application/json'},
								  querystring: "",
								  body: "",
								  method: "PUT",
								  timestamp: new Date().getTime()
								},
								response: {
								  status: 200,
								  body: JSON.stringify(finalListUserToCreateInLMIS, null, 4),
								  timestamp: new Date().getTime()
								}
							}];
							var properties = {};
							properties['Number of added users'] =listResultUsersCreated.length;
							var returnObject = {
							  "x-mediator-urn": urn,
							  "status": status,
							  "response": response,
							  "orchestrations": orchestrationsResultsSyncUsers,
							  "properties": properties
							}
							res.set('Content-Type', 'application/json+openhim');
							res.send(returnObject);
						});//end async.listResultUsersCreated
					});//end async.listLmisUserToCreate
				}//end if. nbrOfUserToAddInLMIS
				else
				{
					winston.warn("No users to create in eSIGL");
					var urn = mediatorConfig.urn;
					var status = 'Successful';
					var response = {
					  status: 200,
					  headers: {
						'content-type': 'application/json'
					  },
					  body:JSON.stringify( {'userSynchedOperation':'No users to create in eSIGL'}),
					  timestamp: new Date().getTime
					};
					var orchestrationsResultsSyncUsers=[{
						name: "push Moodle=>eSIGL",
						request: {
						  path : mediatorConfig.defaultChannelConfig[0].routes[0].path,
						  headers: {'Content-Type': 'application/json'},
						  querystring: "",
						  body: "",
						  method: "PUT",
						  timestamp: new Date().getTime()
						},
						response: {
						  status: 200,
						  body: JSON.stringify({}, null, 4),
						  timestamp: new Date().getTime()
						}
					}];
					var properties = {};
					properties['Number of added users'] =0;
					var returnObject = {
					  "x-mediator-urn": urn,
					  "status": status,
					  "response": response,
					  "orchestrations": orchestrationsResultsSyncUsers,
					  "properties": properties
					}
					res.set('Content-Type', 'application/json+openhim');
					res.send(returnObject);
				}
			}//end if _listUserAndAssociatedCourse
			else
			{
				winston.warn("No new users to returns from courses");
				var urn = mediatorConfig.urn;
				var status = 'Successful';
				var response = {
				  status: 200,
				  headers: {
					'content-type': 'application/json'
				  },
				  body:JSON.stringify( {'userSynchedOperation':'No new users to returns from courses'}),
				  timestamp: new Date().getTime
				};
				var orchestrationsResultsSyncUsers=[{
					name: "push Moodle=>eSIGL",
					request: {
					  path : mediatorConfig.defaultChannelConfig[0].routes[0].path,
					  headers: {'Content-Type': 'application/json'},
					  querystring: "",
					  body: "",
					  method: "PUT",
					  timestamp: new Date().getTime()
					},
					response: {
					  status: 200,
					  body: JSON.stringify({}, null, 4),
					  timestamp: new Date().getTime()
					}
				}];
				var properties = {};
				properties['Number of added users'] =0;
				var returnObject = {
				  "x-mediator-urn": urn,
				  "status": status,
				  "response": response,
				  "orchestrations": orchestrationsResultsSyncUsers,
				  "properties": properties
				}
				res.set('Content-Type', 'application/json+openhim');
				res.send(returnObject);
			}//end else if _listUserAndAssociatedCourse
			//return;
		})//end async [1,2,3]
		
	})//end of app.get /product2dhsi2
	
	
  return app 
}
/**Functions section*
 * */
function getListMoodleCoursesAndUsers(mainCallback)
{
	var listUsersToExclude=config.usernameToExclude.split(",");
	//console.log(config)
	var listOfCourses=[];
	var listCourseWithCategories=[];
	const wsMoodleURL=config.moodleParams.url+config.moodleParams.apiPath+config.moodleParams.token;
	//Get All coures in moodle
	var _listCoursesToProcess=config.coursesToProcess.split(",");
	syncAPI.getListCourses(wsMoodleURL,function(returnedCourses)
	{
		//console.log(returnedCourses);
		var listCourses=[];
		for(var indexCourse=0;indexCourse<returnedCourses.length;indexCourse++)
		{
			if(_listCoursesToProcess.includes(returnedCourses[indexCourse].shortname))
			{
				listCourses.push(returnedCourses[indexCourse]);
			}
		}
		if(listCourses!=null)
		{
			if(listCourses.length>0)
			{
				var async = require("async");
				var listTopicsCourses=[];
				//Remove the site object, not really courses topics
				for(var indexCourses=0;indexCourses<listCourses.length;indexCourses++)
				{
					if(listCourses[indexCourses].format=="topics")
					{
						//listTopicsCourses.push(listCourses[indexCourses]);
						var tempCourseCustomized=transformToCourseCustomizedObject(listCourses[indexCourses]);
						listTopicsCourses.push(tempCourseCustomized);
					}
					else
					{
						continue;
					}
				}//end for
				//console.log(listTopicsCourses);
				if(listTopicsCourses.length==0)
				{
					winston.warn("-----No courses available in this moodle instance. Only users enrolled in the courses could be processed!");
					mainCallback();
				}
				else
				{
					winston.info("--------------Returned ListCourses ---------------");
					var listRegisteredUser=[];//users registers manualy or self without verification of valide users
					//getthe list of Synched users
					var listAlreadySynchedUsers=[];
					syncAPI.getAllSynchedUsers(function(listSynchedUsers)
					{
						listAlreadySynchedUsers=listSynchedUsers;
						var asyncUser = require("async");
						//Add categories informations to the course
						var listValidUsers=[];
						var listCourseWithCategories=listTopicsCourses;
						asyncUser.each(listCourseWithCategories,function(oCourse,callback)
						{
							winston.info("Get users for the course:"+oCourse.id);
							syncAPI.getListEnrolledUsers(wsMoodleURL,oCourse.id,function(listUsers)
							{
								var maxUsersToSyncPerCall=parseInt(config.maxUsersToSyncPerCall);
								winston.info("Users found :"+listUsers.length);
								
								if(listUsers.length>0)
								{
									for(var indexUsers=0;indexUsers<listUsers.length;indexUsers++)
									{
										if(listUsersToExclude.includes(listUsers[indexUsers].username))
										{
											continue;
										}
										else
										{
											var found=checkUserIdInSynchedList(listUsers[indexUsers].id,listAlreadySynchedUsers);
											if(found)
											{
												continue;
											}
											//var tempUserCustomized=transformToUserCustomizedObject(listUsers.users[indexUsers]);
											if(listValidUsers.length < maxUsersToSyncPerCall)
											{
												var tempUserCustomized=transformToUserCustomizedObject(listUsers[indexUsers]);
												listValidUsers.push(tempUserCustomized);
											}
											
										}
									}//end of for
									//console.log("listUsers retained"+listValidUsers.length);
								}//end if listUsers
								callback();
							});
								
						},function(err)
						{
							if(err)
							{
								winston.err(err);
							}
							winston.info("Nbre of users to process for this call: "+listValidUsers.length);
							//console.log(listValidUsers);
							//return;
							mainCallback(listValidUsers);
						})//end asyncUser.listCourseWithCategories
									
									
					})//end syncAPI.getAllSynchedUsers
					
				}//fin else listTopicCourses.length
				
				
			}//end if listcourse lenghth 
		}//end if listcourse null
		else
		{
			console.log("-----No courses available in this moodle instance. Only user enrolled in the course could be processed!");
			mainCallback([]);
		}
		//return res.end();
	});//End API getListCoures
}
function transformToCourseCustomizedObject(moodleRawCourse)
{
	var oCourse={};
	oCourse=Object.create(Course);
	oCourse.id=moodleRawCourse.id;
	oCourse.categoryid=moodleRawCourse.categoryid;
	oCourse.shortname=moodleRawCourse.shortname;
	oCourse.fullname=moodleRawCourse.fullname;
	//oCourse.enrolledusercount=lmoodleRawCourse.enrolledusercount;
	oCourse.idnumber=moodleRawCourse.idnumber;
	oCourse.visible=moodleRawCourse.visible;
	oCourse.format=moodleRawCourse.format;
	oCourse.showgrades=moodleRawCourse.showgrades;
	oCourse.lang=moodleRawCourse.lang;
	oCourse.enablecompletion=moodleRawCourse.enablecompletion;
	oCourse.category=moodleRawCourse.categoryid;
	//oCourse.progress=moodleRawCourse.progress;
	oCourse.startdate=moodleRawCourse.startdate;
	oCourse.enddate=moodleRawCourse.enddate;
	oCourse.category="";
	return oCourse;
} 
function transformToUserCustomizedObject(moodleRawUser)
{
	var oUser={};
	oUser=Object.create(User);
	//Assign moodle user attribute to user object
	oUser.id=moodleRawUser.id;
	oUser.username=moodleRawUser.username;
	oUser.firstname=moodleRawUser.firstname;
	oUser.lastname=moodleRawUser.lastname;
	oUser.fullname=moodleRawUser.fullname;
	oUser.email=moodleRawUser.email;
	oUser.department=moodleRawUser.department;
	oUser.firstaccess=moodleRawUser.firstaccess;
	oUser.lastaccess=moodleRawUser.lastaccess;
	oUser.auth=moodleRawUser.auth;
	oUser.suspended=moodleRawUser.suspended;
	oUser.confirmed=moodleRawUser.confirmed;
	oUser.lang=moodleRawUser.lang;
	oUser.theme=moodleRawUser.theme;
	oUser.timezone=moodleRawUser.timezone;
	oUser.mailformat=moodleRawUser.mailformat;
	if(moodleRawUser.customfields!=null)
	{
		oUser.customfields=moodleRawUser.customfields;
	}
	
	oUser.enrolledCourses=[];
	return oUser;
}
function getLmisUsersFromFacility(facilityId,listLmisFacilities)
{
	var usersFound=[];
	for(var indexFacility=0;indexFacility<listLmisFacilities.length;indexFacility++)
	{
		if(listLmisFacilities[indexFacility].id==facilityId)
		{
			usersFound=listLmisFacilities[indexFacility].users;
			break;
		}
		else
		{
			continue;
		}
	}
	return usersFound;
}
function getLmisUsersWithUsername(username,listLmisUsers)
{
	var userFound=null;
	for(var indexUser=0;indexUser<listLmisUsers.length;indexUser++)
	{
		if(listLmisUsers[indexUser].username==username)
		{
			userFound=listLmisUsers[indexUser];
			break;
		}
		else
		{
			continue;
		}
	}
	return userFound;
}
function sortListFacilityByNbrUserAndName(listFacilities)
{
	var listSortedFacilities=[];
	var maxLength=listFacilities.length;
	for(var K = 0; K < maxLength; K++)
	{
		for(var I = maxLength - 2;I >= 0; I--)
		{
			for(var J = 0; J <= I; J++) {
				if(listFacilities[J+1].users.length<listFacilities[J].users.length && listFacilities[J+1].name<listFacilities[J].name ){
					var t=listFacilities[J+1];
					listFacilities[J+1]=listFacilities[J];
					listFacilities[J]=t;
				}
			}
		}
	}
	listSortedFacilities=listFacilities;
	return listSortedFacilities;
}
function checkUserIdInSynchedList(userId,synchedUserLists)
{
	var found=false;
	for(var index=0;index<synchedUserLists.length;index++)
	{
		if(synchedUserLists[index].userid==""+userId)
		{
			found=true;
			break;
		}
	}
	return found;
}
function sortListUsersById(listMoodleUsers)
{
	var listSortedUsers=[];
	var maxLength=listMoodleUsers.length;
	for(var K = 0; K < maxLength; K++)
	{
		for(var I = maxLength - 2;I >= 0; I--)
		{
			for(var J = 0; J <= I; J++) {
				if(listMoodleUsers[J+1].id<listMoodleUsers[J].id){
					var t=listMoodleUsers[J+1];
					listMoodleUsers[J+1]=listMoodleUsers[J];
					listMoodleUsers[J]=t;
				}
			}
		}
	}
	listSortedUsers=listMoodleUsers;
	return listSortedUsers;
}
function getRoleByName(roleName,listRoles)
{
	var roleFound=null;
	for(var indexRole=0;indexRole<listRoles.length;indexRole++)
	{
		/*
		console.log(listRoles[indexRole].name.trim().toLowerCase()+"=="+roleName.trim().toLowerCase());
		console.log(""+listRoles[indexRole].name.trim().toLowerCase()==""+roleName.trim().toLowerCase());
		console.log("-------------------------------------------------------");
		* */
		if(listRoles[indexRole].name.trim().toLowerCase()==roleName.trim().toLowerCase())
		{
			roleFound=listRoles[indexRole];
			break;
		}
	}
	return roleFound;
}

function getListLMISFacilitiesAndAssociatedUsersV2(callback)
{
	const lmisV2RootUrl=config.esiglServer.url+config.esiglServer.resourcespath;
	const basicAuthAccessOpenLMISV2 = `Basic ${btoa(config.esiglServer.username+':'+config.esiglServer.password)}`;
	const pgConnectionString=config.pgConnectionString;
	syncAPI.getListFacilityV2(lmisV2RootUrl,basicAuthAccessOpenLMISV2,function(listFacilities)
	{
		var _listFacilities=[];
		//var allFacilities=listFacilities;
		var async = require("async");
		winston.info("Returned facilities:"+listFacilities.length);
		//Select only facilities with productProgram
		async.each(listFacilities,function(oFacility,callbackFacility)
		{
			console.log("Check if "+oFacility.code +" has program...");
			syncAPI.checkFacilityHasProgramProducts(lmisV2RootUrl,basicAuthAccessOpenLMISV2,oFacility.code,function(isProgramFacility)
			{
				//console.log(isProgramFacility);
				if(isProgramFacility)
				{
					_listFacilities.push(oFacility);
				}
				callbackFacility();
			});
			
		},function(err)
		{
			if(err)
			{
				console.log(err);
			}
			winston.info("Facilities with product-programs :"+_listFacilities.length +"/"+listFacilities.length);
			syncAPI.getListUsersOpenLMISV2(pgConnectionString,function(listUsers)
			{
				var _listUsers=listUsers;
				//console.log(_listUsers);
				if(_listUsers.length>0)
				{
					for(var indexFacility=0;indexFacility<_listFacilities.length;indexFacility++)
					{
						//for each facilities, find user that have if as home facility
						for(var indexUser=0;indexUser<_listUsers.length;indexUser++)
						{
							//console.log(_listUsers[indexUser].homeFacilityId+"=="+_listFacilities[indexFacility].id+"=>");
							//console.log(_listUsers[indexUser].homeFacilityId==_listFacilities[indexFacility].id);
							if(_listUsers[indexUser].homeFacilityId==_listFacilities[indexFacility].id)
							{
								//console.log("Match...");
								_listFacilities[indexFacility].users.push(_listUsers[indexUser]);
								//console.log(_listFacilities[indexFacility]);
								//console.log("----------------------------");
							}
							else
							{
								continue;
							}
						}
					}
					winston.info("Returns eSIGL facilities and associated users: "+_listFacilities.length);
					callback(_listFacilities);
					
				}
				else
				{
					winston.warn("Returns eSIGL facilities and associated users :"+_listFacilities.length);
					callback(_listFacilities);
				}
			});//end get listUsers
			
		});//end async _listFacilities
		
		
		
		
	});//End getFacilities

}
function getLMISRolesV2(callback)
{
	const pgConnectionString=config.pgConnectionString;
	syncAPI.getListRolesLMISV2(pgConnectionString,function(listRoles)
	{
		return callback(listRoles);
	});
}

/**
 * start - starts the mediator
 *
 * @param  {Function} callback a node style callback that is called once the
 * server is started
 */
function start (callback) {
  if (apiConf.api.trustSelfSigned) { process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0' }

  if (apiConf.register) {
    medUtils.registerMediator(apiConf.api, mediatorConfig, (err) => {
      if (err) {
        winston.error('Failed to register this mediator, check your config')
        winston.error(err.stack)
        process.exit(1)
      }
      apiConf.api.urn = mediatorConfig.urn
      medUtils.fetchConfig(apiConf.api, (err, newConfig) => {
        winston.info('Received initial config:')
        winston.info(JSON.stringify(newConfig))
        config = newConfig
        if (err) {
          winston.error('Failed to fetch initial config')
          winston.error(err.stack)
          process.exit(1)
        } else {
          winston.info('Successfully registered mediator!')
          let app = setupApp()
          const server = app.listen(port, () => {
            if (apiConf.heartbeat) {
              let configEmitter = medUtils.activateHeartbeat(apiConf.api)
              configEmitter.on('config', (newConfig) => {
                winston.info('Received updated config:')
                winston.info(JSON.stringify(newConfig))
                // set new config for mediator
                config = newConfig

                // we can act on the new config received from the OpenHIM here
                winston.info(config)
              })
            }
            callback(server)
          })
        }
      })
    })
  } else {
    // default to config from mediator registration
    config = mediatorConfig.config
    let app = setupApp()
    const server = app.listen(port, () => callback(server))
  }
}
exports.start = start

if (!module.parent) {
  // if this script is run directly, start the server
  start(() => winston.info(`Listening on ${port}...`))
}
