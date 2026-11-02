import {startLocalFixture}from'./local-fixture.mjs';
export async function startPdfFixture(port=0){
 const f=await startLocalFixture(port);
 try {
 const baseUser=await f.models.User.findById(f.cast.admin.user).select('+passwordHash');
 const e=await f.models.Employee.create({empId:'TEST-HR28',firstName:'HR Reviewer',department:'HR',branch:'Test HQ'});
 const u=await f.models.User.create({name:'HR Reviewer',email:'hr28@datum-test.example',role:'hr',employee:e._id,passwordHash:baseUser.passwordHash});
 f.cast.hr={email:u.email,user:String(u._id),employee:String(e._id),role:'hr'};
 for(const name of['TravelRequest','TravelBooking','ServiceDashboard','StageReview'])Object.assign(f.models,await import(`../api/src/models/${name}.js`));
 await f.models.TravelRequest.create({employee:f.cast.engineer.employee,project:f.project,purpose:'Historical site inspection',departureDate:'2024-01-11',returnDate:'2024-01-12'});
 await f.models.TravelBooking.create({employee:f.cast.tl.employee,project:f.project,reason:'Historical finance booking',toCity:'Mysuru',departureDate:'2024-02-12',status:'Completed'});
 await f.models.StageReview.create({project:f.project,stage:'CD',reviewer:'Saved review author',outcome:'Approved'});
 await f.models.ServiceDashboard.create({project:f.project,service:'STR',technicalDirector:'Saved director',scopeStatus:'In Progress'});
 return f;
 } catch(error){await f.stop();throw error;}
}
