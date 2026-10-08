import { z } from 'zod';
import { EMPLOYEE_STATUSES } from '../models/Employee.js';

const dateOpt = z.coerce.date().optional();
const strOpt = z.string().trim().optional();

// Payroll-master form (§4.7): core fields validated, the rest accepted
// as-submitted and stored on the employee record.
export const employeeSchema = z
  .object({
    empId: z.string().trim().optional(),
    salutation: strOpt,
    firstName: z.string().trim().min(1),
    middleName: strOpt,
    lastName: z.string().trim().min(1),
    shortName: strOpt,
    fatherName: strOpt,
    motherName: strOpt,
    dob: dateOpt,
    sex: strOpt,
    maritalStatus: strOpt,
    spouseName: strOpt,
    designation: z.string().trim().min(1),
    qualification: strOpt,
    department: z.string().trim().min(1),
    reportingManager: strOpt,
    branch: z.string().trim().min(1),
    division: strOpt,
    salaryStructure: strOpt,
    bank: z
      .object({
        account: strOpt,
        name: strOpt,
        ifsc: strOpt,
      })
      .strict()
      .optional(),
    address: z
      .object({
        line1: strOpt,
        line2: strOpt,
        city: strOpt,
        state: strOpt,
        zip: strOpt,
      })
      .strict()
      .optional(),
    email: z.string().trim().toLowerCase().email().optional().or(z.literal('')),
    stdCode: strOpt,
    phone: strOpt,
    mobile: strOpt,
    dateOfJoining: z.coerce.date(),
    salaryFrom: dateOpt,
    leavingDate: dateOpt,
    leavingReason: strOpt,
    esi: z
      .object({
        applicable: z.boolean().optional(),
        number: strOpt,
        dispensary: strOpt,
      })
      .strict()
      .optional(),
    pf: z
      .object({
        applicable: z.boolean().optional(),
        number: strOpt,
        fileNumber: strOpt,
        uan: strOpt,
        restrictPF: z.boolean().optional(),
        zeroPension: z.boolean().optional(),
      })
      .strict()
      .optional(),
    zeroPT: z.boolean().optional(),
    pan: strOpt,
    wardCircle: strOpt,
    director: strOpt,
    aadhar: strOpt,
    remarks: strOpt,
    rejoinee: z.preprocess((v) => (v === '' ? undefined : v), z.boolean().optional()),
    previousEmpId: strOpt,
    experience: strOpt,
    status: z.preprocess(
      (v) => {
        if (v === undefined || v === null) return undefined;
        const s = String(v).trim();
        if (s === '') return undefined;
        const lower = s.toLowerCase();
        if (lower === 'active') return 'Active';
        if (lower === 'on leave' || lower === 'on-leave' || lower === 'onleave') return 'On Leave';
        if (lower === 'exited') return 'Exited';
        return s;
      },
      z.enum(EMPLOYEE_STATUSES).optional(),
    ),
  })
  .strict();

export const employeeUpdateSchema = employeeSchema.partial();

// Optional login provisioning on employee create (FD/HR/Admin only).
export const employeeLoginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(8),
    role: z.string().trim().min(1),
  })
  .strict();
