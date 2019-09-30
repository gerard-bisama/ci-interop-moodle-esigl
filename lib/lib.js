const moment = require('moment');
const url=require('url');
//const manifest = require('../config/manifest')
//const mediatorConfig = require('../config/mediator');
var mongoose = require('mongoose');
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var crypto = require('crypto');
var pgClient = require('pg-native');
var btoa = require('btoa');

/***
 * Variables definition section
 * */
mongoose.connect('mongodb://localhost:27017/interopmediator');
var Schema=mongoose.Schema;
//const wsMoodleURL=mediatorConfig.config.moodleParams.url+mediatorConfig.config.moodleParams.apiPath+mediatorConfig.config.moodleParams.token;
//const lmisV2RootUrl=mediatorConfig.config.esiglServer.url+mediatorConfig.config.esiglServer.resourcespath;
//const basicAuthAccessOpenLMISV2 = `Basic ${btoa(mediatorConfig.config.esiglServer.username+':'+mediatorConfig.config.esiglServer.password)}`;
//const pgConnectionString=mediatorConfig.config.pgConnectionString;
/**Custom functions section
 * */
 /****************************Data definition structure************************************/
var LmisUser={
	"id":"",
	"username": "",
	"firstName": "",
	"lastName": "",
	"email": "",
	"homeFacilityId":"",
	"verified":"",
	"active":"",
	"roles":[]
}
var LmisRole={
	"id":"",
	"name": "",
	"description": "",
	"programId": "", //linked to the program information
	"programName":"",
	"wharehouseId": "",//for fulfillment based role. this is linked to the facility
	"wharehouseName": ""//for fulfillment based role. this is linked to the facility
	}
/***************************************************************/
 exports.getListCourses=function getListCourses(moodleUrl,callback)
{
	var wsMoodleURL=moodleUrl;
	var urlRequest=wsMoodleURL+"&wsfunction=core_course_get_courses";
	//console.log(urlRequest);
	var request = new XMLHttpRequest();
	request.open('GET',urlRequest, true);
	request.setRequestHeader('Content-Type','application/json');
	request.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200) {
			var myArr=null;
			if(this.responseText!="")
			{
				var myArr = JSON.parse(this.responseText);
			}
			return callback(myArr);
		}
		else if (this.readyState == 4 && this.status != 200)
		{
			console.log(this.responseText);
			//return callback(null);
		}
	}
	request.send();
}
exports.getListEnrolledUsers=function getListEnrolledUsers(moodleUrl,courseId,callback)
{
	var wsMoodleURL=moodleUrl;
	var urlRequest=wsMoodleURL+"&wsfunction=core_enrol_get_enrolled_users&courseid="+courseId;
	var request = new XMLHttpRequest();
	request.open('GET',urlRequest, true);
	request.setRequestHeader('Content-Type','application/json');
	request.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200) {
			var myArr=null;
			if(this.responseText!="")
			{
				var myArr = JSON.parse(this.responseText);
			}
			return callback(myArr);
		}
		else if (this.readyState == 4 && this.status != 200)
		{
			//console.log(this.responseText);
			return callback([]);
		}
	}
	request.send();
}
exports.getListFacilityV2=function getListFacilityV2(lmisV2Url,basicAuth,callback)
{
	var lmisV2RootUrl=lmisV2Url;
	var basicAuthAccessOpenLMISV2=basicAuth;
	var urlRequest=`${lmisV2RootUrl}/lookup/facilities?paging=false`;
	//console.log(urlRequest);
	var request = new XMLHttpRequest();
	request.open('GET',urlRequest, true);
	request.setRequestHeader('Content-Type','application/json');
	request.setRequestHeader('Authorization',basicAuthAccessOpenLMISV2);
	request.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200) {
			var response=null;
			if(this.responseText!="")
			{
				//console.log(this.responseText);
				var oReturnedObjectTemp = JSON.parse(this.responseText);
				var oReturnedObject= oReturnedObjectTemp.facilities;
				var listFacilities=[];
				//console.log(oReturnedObject.facilities.length);
				for(var indexFacility=0;indexFacility<oReturnedObject.length;indexFacility++)
				{
					//var facilityTypeToReturn=[1,2,3,4,5];
					//if(oReturnedObject[indexFacility].active && facilityTypeToReturn.includes(oReturnedObject[indexFacility].typeId))
					if(oReturnedObject[indexFacility].active)
					{
						var oObject={id:oReturnedObject[indexFacility].id,name:oReturnedObject[indexFacility].name,
							code:oReturnedObject[indexFacility].code,typeId:oReturnedObject[indexFacility].typeId,
							catchmentPopulation:oReturnedObject[indexFacility].catchmentPopulation,
							suppliesOthers:oReturnedObject[indexFacility].suppliesOthers,
							sdp:oReturnedObject[indexFacility].sdp,
							active:oReturnedObject[indexFacility].active,
							users:[]
							};
							listFacilities.push(oObject);
					}
					else
					{
						continue;
					}
				}//end for indexFacility
				response=listFacilities;
			}
			return callback(response);
		}
		else if (this.readyState == 4 && this.status != 200)
		{
			console.log(this.responseText);
		}
	}
	request.send();
}
exports.checkFacilityHasProgramProducts=function checkFacilityHasProgramProducts(lmisV2Url,basicAuth,facilityCode,callback)
{
	var lmisV2RootUrl=lmisV2Url;
	var basicAuthAccessOpenLMISV2=basicAuth;
	var urlRequest=`${lmisV2RootUrl}/programs-with-products?facilityCode=${facilityCode}`;
	//console.log(urlRequest);
	var request = new XMLHttpRequest();
	request.open('GET',urlRequest, true);
	request.setRequestHeader('Content-Type','application/json');
	request.setRequestHeader('Authorization',basicAuthAccessOpenLMISV2);
	request.onreadystatechange = function() {
		//console.log(this.responseText);
		if (this.readyState == 4 && this.status == 200) {
			var response=null;
			var hasProductProgram=false;
			if(this.responseText!="")
			{
				var oReturnedObject = JSON.parse(this.responseText);
				if(oReturnedObject.programsWithProducts.length>0)
				{
					hasProductProgram=true;
				}
			}
			return callback(hasProductProgram);
		}
		else if (this.readyState == 4 && this.status != 200)
		{
			console.log(this.responseText);
		}
	}
	request.send();
}
exports.getListUsersOpenLMISV2=function getListUsersOpenLMISV2(connexionString,callback)
{
	var pgConnectionString=connexionString;
	var client = new pgClient();
	client.connect(pgConnectionString,function(err) {
		if(err) throw err;
		//text queries
		var listUsers=[];
		var queryUserRoles='select us.id as userid,us.username,us.firstname,us.lastname,us.email,us.verified,us.active,us.facilityid, \
						ra.id,ra.roleid,ro.name as rolename,ro.description,pro.id as programid,pro.name as programname from role_assignments ra \
						join roles  ro on ra.roleid=ro.id \
						left outer join programs pro on pro.id=ra.programid \
						join users us on us.id = ra.userid ';
						
		client.query(queryUserRoles, function(err, rowsUsersRoles) {
			if(err) throw err
			if(rowsUsersRoles.length>0)
			{
				var listConvertedObject=[];
				listConvertedObject=convertToCustomizedLMISObject(rowsUsersRoles);
				callback(listConvertedObject);
			}
			else
			{
				callback([])
			}
			})
	});
}
exports.getListRolesLMISV2=function getListRoles(connectionString,callback)
{
	var pgConnectionString=connectionString;
	var client = new pgClient();
	client.connect(pgConnectionString,function(err) {
		if(err) throw err;
		//text queries
		var listUsers=[];
		var queryUserRoles='select id,name,description from roles order by name';
		client.query(queryUserRoles, function(err, rowsRoles) {
			if(err) throw err
			//console.log("----Roles:---");
			//console.log(rowsRoles);
			if(rowsRoles.length>0)
			{
				var listRoles=[];
				for(var indexRow=0;indexRow<rowsRoles.length;indexRow++)
				{
					listRoles.push(
					{
						id:rowsRoles[indexRow].id,
						name:rowsRoles[indexRow].name,
						description:rowsRoles[indexRow].description
					})
				}
				//callback(JSON.stringify(listRoles));
				callback(listRoles);
			}
			else
			{
				callback([])
			}
			})
	});
}
exports.createLMISUserLMISV2Sync=function createLMISUserLMISV2(connectionString,userObject,callback)
{
	var encryptedPassword=gethashstring(userObject.password);
	var client = new pgClient();
	var pgConnectionString=connectionString;
	client.connectSync(pgConnectionString);
	const queryToInsertUsers='insert into users (username,password,firstname,lastname,email,facilityid,verified,active) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id';
	var values=[userObject.username,encryptedPassword,userObject.firstName,userObject.lastName,userObject.email,userObject.homeFacilityId,true,true];
	var rowsUsers = client.querySync(queryToInsertUsers,values);
	if(rowsUsers[0].id!=null)
	{
		for(var indexRole=0;indexRole<userObject.roleAssignments.length;indexRole++)
		{
			var queryInsertRole='insert into role_assignments (userid,roleid,programid) values ($1,$2,$3)';
			var valuesRole=[rowsUsers[0].id,userObject.roleAssignments[indexRole].roleId,userObject.roleAssignments[indexRole].programId];
			var resQuery=client.querySync(queryInsertRole,valuesRole);
		}
		return callback(true);
	}
	else
	{
		return callback(false);
	}
	//return
}
function gethashstring(passwordString)
{
	var encodedHash=crypto.createHash('sha512').update(passwordString).digest('base64');
	var stringEncodedBytes=encodedHash.toString();
	var base64ToBase62String=base64ToBase62(stringEncodedBytes);
	return base64ToBase62String;
	
}
function base64ToBase62(base64)
{
	var buff="";
	for(var i=0;i<base64.length;i++)
	{
		var ch=base64[i];
		switch(ch) {
		  case "i":
			buff+="ii"
			break;
		case "+":
			buff+="ip"
			break;
		case "/":
			buff+="is"
			break;
		case "=":
			buff+="ie"
			break;
		case "\n":
			// Strip out
			break;
		default:
		 buff+=ch
		}
	}
	return buff;
}
///Convert the sqlrows result to customizedObject
function convertToCustomizedLMISObject(rowsUserRoles)
{
	var listConvertedLMISObject=[];
	var listUserIndex=[];
	for(var index=0;index<rowsUserRoles.length;index++)
	{
		
		if(listUserIndex.includes(rowsUserRoles[index].userid))
		{
			//if user exist already in the row, check if the role as been already assigned
			for(var indexlistOject=0;indexlistOject<listConvertedLMISObject.length;indexlistOject++)
			{
				
				if(listConvertedLMISObject[indexlistOject].id==rowsUserRoles[index].userid)
				{
					var assignedRole=listConvertedLMISObject[indexlistOject].roles;
					var roleExist=false;
					for(var indexRole=0;indexRole<assignedRole.length;indexRole++)
					{
						var rowProgramid=rowsUserRoles[index].programid==null?"":rowsUserRoles[index].programid;
						if(assignedRole[indexRole].id==rowsUserRoles[index].roleid && assignedRole[indexRole].programId==rowProgramid)
						{
							roleExist=true;
							break;
						}
						else
						{
							continue;
						}
					}
					if(!roleExist)
					{
						var oRole={};
						oRole=Object.create(LmisRole);
						oRole.id=rowsUserRoles[index].roleid;
						oRole.name=rowsUserRoles[index].rolename;
						oRole.description=rowsUserRoles[index].description;
						if(rowsUserRoles[index].programid!=null)
						{
							oRole.programId=rowsUserRoles[index].programid;
							oRole.programName=rowsUserRoles[index].programname;
						}
						listConvertedLMISObject[indexlistOject].roles.push(oRole);
					}
				}
				else
				{
					continue;
				}
			}
		}
		else
		{
			var oUser={};
			oUser=Object.create(LmisUser);
			oUser.id=rowsUserRoles[index].userid;
			oUser.username=rowsUserRoles[index].username;
			oUser.firstName=rowsUserRoles[index].firstname;
			oUser.lastName=rowsUserRoles[index].lastname;
			oUser.email=rowsUserRoles[index].email;
			oUser.homeFacilityId=rowsUserRoles[index].facilityid;
			oUser.verified=rowsUserRoles[index].verified;
			oUser.active=rowsUserRoles[index].active;
			oUser.roles=[];
			//if(rowsUserRoles[index].roleid!=)
			var oRole={};
			oRole=Object.create(LmisRole);
			oRole.id=rowsUserRoles[index].roleid;
			oRole.name=rowsUserRoles[index].rolename;
			oRole.description=rowsUserRoles[index].description;
			if(rowsUserRoles[index].programid!=null)
			{
				oRole.programId=rowsUserRoles[index].programid;
				oRole.programName=rowsUserRoles[index].programname;
			}
			else
			{
				oRole.programId="";
				oRole.programName="";
			}
			/*console.log("-------Created role-------------------------");
			console.log(oRole);*/
			oUser.roles.push(oRole);
			listConvertedLMISObject.push(oUser);
			listUserIndex.push(oUser.id);
		}
	}
	return listConvertedLMISObject;
}
exports.getlmisUserRolesAndProgramRules=function getlmisUserRolesAndProgramRules(lmisUserCreationRolesAndProgramRules)
{
	var listRolesPrograms=[];
	//console.log(lmisUserCreationRolesAndProgramRules.RolesAndProgramRules1);
	//var _lmisUserCreationRolesAndProgramRules=lmisUserCreationRolesAndProgramRules;
	if(lmisUserCreationRolesAndProgramRules.RolesAndProgramRules1!=null)
	{
		var tempArrayProgramRules=lmisUserCreationRolesAndProgramRules.RolesAndProgramRules1.split(",");
		listRolesPrograms.push(
		{
			role:tempArrayProgramRules[0],
			program_wharehouse:tempArrayProgramRules[1]
		}
		)
	}
	if(lmisUserCreationRolesAndProgramRules.RolesAndProgramRules2!=null)
	{
		var tempArrayProgramRules=lmisUserCreationRolesAndProgramRules.RolesAndProgramRules2.split(",");
		listRolesPrograms.push(
		{
			role:tempArrayProgramRules[0],
			program_wharehouse:tempArrayProgramRules[1]
		}
		)
	}
	if(lmisUserCreationRolesAndProgramRules.RolesAndProgramRules3!=null)
	{
		var tempArrayProgramRules=lmisUserCreationRolesAndProgramRules.RolesAndProgramRules3.split(",");
		listRolesPrograms.push(
		{
			role:tempArrayProgramRules[0],
			program_wharehouse:tempArrayProgramRules[1]
		}
		)
	}
	return listRolesPrograms;
	
}
//---------------------------------Mongodb part to manage http load to push requisition to fhir server--------------------------
var usersSyncLogSchema=Schema({
	userid:String, //by default 1
	periodDate:Date
});
var synchedUsersDefinition=mongoose.model('synchedUsers',usersSyncLogSchema);//keep logs of users pull from moodle and synched to LMIS
var getAllSynchedUsers=function (callback)
{
	var requestResult=synchedUsersDefinition.find({},{"_id":0,"periodDate":0}).exec(function(error,synchedUsersList){
		if(error){
			console.log(error);
			callback([]);
			}
		return callback(synchedUsersList);
		});
}
var upsertSynchedUsers=function(synchedDate,synchedUserId,callback)
{
	synchedUsersDefinition.findOne({
			userid:synchedUserId,
			}).exec(function(error,foundSynchedUser){
				if(error) {
					console.log(error);
					callback(false)
				}
				else
				{
					if(!foundSynchedUser)
					{
						
						var newUser= new synchedUsersDefinition({userid:synchedUserId,
							periodDate:synchedDate});
						
						var requestResult=newUser.save(function(err,result){
							if(err)
							{
								console.log(err);
								callback(false);
							}
							else
							{
								callback(true);
							}
						});
					}
					else
					{
						console.log("users already logged!");
					}
				}
			})//end of exec
}
var saveAllSynchedUsers=function (periodDate,synchedUsersList,callBackReturn)
{
	const async = require("async"); 
	var result=false;
	var _periodDate=new Date(periodDate);
	//console.log(`requestString => ${_minStartDate} : ${_maxStartDate}`);
	async.each(synchedUsersList,function(synchedUser,callback)
	{
		upsertSynchedUsers(_periodDate,synchedUser.id,function(response)
		{
			result=response;
			if(response)
			{
				console.log(synchedUser.id +"inserted with success.");
			}
			else
			{
				console.log(synchedUser.id +"failed to be inserted!");
			}
			callback(response);
		})
	},function(err)
	{
		if(err)
		{
			console.log(err);
			callBackReturn(false);
		}
		if(result)
		{
			callBackReturn(true);
		}
		else
		{
			callBackReturn(false);
		}
		
	});//end of asynch
}

exports.getAllSynchedUsers=getAllSynchedUsers;
exports.saveAllSynchedUsers=saveAllSynchedUsers;
