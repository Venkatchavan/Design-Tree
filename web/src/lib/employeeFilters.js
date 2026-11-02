import { serviceNames } from './services.js';
export const employeeRecord = row => row?.employee && typeof row.employee === 'object' ? row.employee : row;
export const employeeId = row => String(employeeRecord(row)?._id ?? employeeRecord(row)?.id ?? row?.employee ?? '');
export const employeeName = row => { const e=employeeRecord(row)??{};return [e.firstName,e.middleName,e.lastName].filter(Boolean).join(' ') || e.name || e.label || e.empId || ''; };
export const employeeServices = row => serviceNames([employeeRecord(row)?.department,employeeRecord(row)?.service,row?.service]);
export function filterEmployees(employees, {search='',branch='',service='',selectedIds=[]}={}, getId=employeeId) {
  const selected=new Set(selectedIds.map(String));const query=search.trim().toLowerCase();
  return employees.filter(row=>{
    if(selected.has(String(getId(row))))return true;
    const e=employeeRecord(row)??{};
    return (!branch||(e.branch||'Not recorded')===branch)&&(!service||employeeServices(row).includes(service)||(service==='Not recorded'&&!employeeServices(row).length))&&(!query||[employeeName(row),e.empId,e.email,e.designation,...employeeServices(row)].filter(Boolean).join(' ').toLowerCase().includes(query));
  });
}
