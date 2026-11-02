import {TravelRequest} from '../models/TravelRequest.js';
import {TravelBooking} from '../models/TravelBooking.js';
import {directoryPage} from '../utils/directoryPage.js';

// Reporting only: requests and bookings remain distinct source records.
export async function travelLog(req,res,next) {
  try {
    const {page,limit,skip}=directoryPage(req.query);
    const populate=[{path:'employee',select:'firstName middleName lastName empId branch'},{path:'project',select:'name jobNumber'}];
    const fields='employee project purpose reason fromCity toCity departureDate returnDate status createdAt actualExpense estExpense';
    const models=[['Request',TravelRequest],['Booking',TravelBooking]];
    const results=await Promise.all(models.map(async([source,Model])=>{
      // Each source needs only its first skip+limit rows for the combined page.
      const [rows,total]=await Promise.all([Model.find({}).select(fields).sort({departureDate:-1,_id:-1}).limit(skip+limit).populate(populate).lean(),Model.countDocuments({})]);
      return {total,items:rows.map(r=>({id:source+':'+r._id,source,employee:r.employee,project:r.project,purpose:r.purpose||r.reason,fromCity:r.fromCity,toCity:r.toCity,departureDate:r.departureDate,returnDate:r.returnDate,status:r.status,actualExpense:r.actualExpense,estExpense:r.estExpense}))};
    }));
    const total=results.reduce((n,r)=>n+r.total,0);
    const items=results.flatMap(r=>r.items).sort((a,b)=>(Date.parse(b.departureDate)||0)-(Date.parse(a.departureDate)||0)||b.id.localeCompare(a.id)).slice(skip,skip+limit);
    return res.json({items,total,page,limit,hasMore:skip+items.length<total});
  }catch(error){return next(error);}
}
