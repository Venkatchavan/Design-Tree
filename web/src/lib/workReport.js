import { addHours } from './workHours.js';
export { addHours } from './workHours.js';
import { request, toQuery } from './api.js';
export const businessDate = (value = new Date()) => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
export const hoursText = value => String(Number(value ?? 0));
export async function collectPages(load, params = {}) {
  const items=[], keys=new Set(); let offset=0, page, expectedTotal;
  do {
    page=await load({...params,offset,limit:200});
    if(expectedTotal === undefined) expectedTotal=page.total;
    if(page.total !== expectedTotal) throw new Error('Work report changed while loading. Retry the report.');
    for(const item of page.items ?? []) {
      const identity=item.key ?? String(item._id);
      if(keys.has(identity)) throw new Error('Work report changed while loading. Retry the report.');
      keys.add(identity);
    }
    if(!page.items?.length && offset<page.total) throw new Error('Work report changed while loading. Retry the report.');
    items.push(...page.items);offset+=page.items.length;
  } while(offset<page.total);
  return {...page,items,total:items.length};
}
export const workReportApi = {
  list: params => collectPages(p=>request(`/api/reports/work-hours${toQuery(p)}`),params),
};
export function groupWorkDays(items) {
  const groups=new Map();
  for(const entry of items) {
    const date=entry.date?businessDate(entry.date):'Date not recorded',group=groups.get(date)??{date,items:[],hours:0};
    group.items.push(entry);group.hours=addHours(group.hours,entry.totalHours);groups.set(date,group);
  }
  return [...groups.values()].sort((a,b)=>b.date.localeCompare(a.date));
}
