# Moodle-OpenLMIS Sync app
Moodle is a free, online Learning Management system enabling educators to create their own private website filled with dynamic courses that extend learning, any time, anywhere.Whether you're a teacher, student or administrator, Moodle can meet your needs. Moodle’s extremely customisable core comes with many standard features.[About Moodle](https://docs.moodle.org/35/en/Features).

OpenLMISis a powerful, open source, cloud-based electronic logistics management information system (LMIS) purpose-built to manage health commodity supply chains.[About OpenLMIS](https://docs.moodle.org/35/en/Features). This mediator is developped to use the openLMIS Version2.

The app is used to create a sandbox for people to practice their skills learned in moodle on  OpenLMIS. The idea is, we want to have trainees spend some time in the application to hone their skills by linking out of a Moodle lesson right into the openLMIS, and to isolate each user (meaning trainee) into their own session with pre-populated data in order to follow the progression of the course in Moodle with exercises in OpenLMIS that they need to complete in order to get the “answer”. Moodle will provide the tutorial and openLMIS will be used for pratice.

To meet this requirement we have opted to assign each moodle user to a specific facility and program with specific roles that can be updated from the openHIM console. 
This two plateforms have APIs that allow to access internal ressources and to share them with other systems. OpenHIM is used to orchestrate the exchange of resources between these two systems. 
For information on how to use Moodle go to [Moodle API](https://docs.moodle.org/dev/Web_services_API).
For openLMIS V2 there is not a lot of documentation on OpenLMIS v2 API docs but general information can be found here [OpenLMIS Wiki](https://openlmis.atlassian.net/wiki/spaces/OP/overview)
## Uses cases
The base use case is to synchronized user between the two system, so that once a user is create in Moodle, he will have also an account in openLMIS with appropriated role to practice in openLMIS.

### Use case 1 (Base use case): Synchronize Moodle user in OpenLMIS
The user is created and enrolled to one or more courses. Based on the defined scheduled, the mediator check if there is moodle user to sync in openLMIS. if OK, the user is created,the role is assigned based on the configuration file of the mediator. Only roles related to the supervision and fullfilment are considered and they are all related to the home facility where user is assigned. To allow a user to have a optimal isolation for his own exercice for the training, the app sort facility by name and by number of users assigned and then assign the user to the selected facility. The good configuration is to have in openLMIS at least the  number of users >=number of facilities. Once the user is created an email is sent with his credentiales to connect in openLIMS.

### Use case 2:Get Orders and requisitions
TBD

## Configurations
Some configurations must be done both in Moodle to ensure exchange of data between the two systems
###Moodle
1. Set up email out going notification to allow users to receive notification related to their enrolment, this is very usefull to send notification.
2. [Create and enable webservice plugin](https://docs.moodle.org/35/en/Using_web_services). Ensure to get token from an external service, enable REST protocol. Add an external service "webservice" with the following functions:core_course_get_categories, core_course_get_courses, core_enrol_get_users_courses, core_user_create_users, core_user_get_user_preferences, core_user_get_users, core_user_view_user_profile,core_enrol_get_users_courses.
###The mediator
The mediator is the microapp developed under openHIM standard and it is the main component that extract, transform and exchange data between the 2 systems.
Once installed we must configure the mediators with parameters of Moodle and openLMIS, but defaults it comes with empty parameters.
Go to openHIM>Mediators>Exchange moodle data with openLMIS>Configurations. Then provide all parameters.
If the mediator is runned for the first time, install the channel "Pull users from moodle and push them to openLMIS" from the mediator page by clicking on the button (+).


## Installation
The architecture requires the following components to be installed
### OpenHIM
* [OpenHIM-Core](https://openhim.readthedocs.io/en/latest/getting-started.html)
* [OpenHIM Console](https://openhim.readthedocs.io/en/latest/getting-started.html)
### Mediators
```
git clone https://github.com/gerard-bisama/ci-interop-moodle-esigl.git
```
To run the mediator
```
cd scmci-moodle-esigl
apt-get install libpq-dev g++ make #to install postgres client and library
npm install
npm start
```


### Configure timer to launch synchronization
Add this entries to you crontab to launch the synchronization of user between Moodle and openLMIS every 10 minutes.
```sh
*/10 * * * * curl -k -u exchange:pwd https://localhost:5000/pushmoodle2lmis > /dev/null & #5000 is the default port for openHIM channel.
```

Taratataaa
