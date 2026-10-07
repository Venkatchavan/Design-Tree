import mongoose from 'mongoose';

export const EMPLOYEE_STATUSES = ['Active', 'On Leave', 'Exited'];

const employeeSchema = new mongoose.Schema(
  {
    empId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    salutation: { type: String, trim: true },
    firstName: { type: String, required: true, trim: true },
    middleName: { type: String, trim: true },
    lastName: { type: String, required: true, trim: true },
    shortName: { type: String, trim: true },
    fatherName: { type: String, trim: true },
    motherName: { type: String, trim: true },
    dob: { type: Date },
    sex: { type: String, trim: true },
    maritalStatus: { type: String, trim: true },
    spouseName: { type: String, trim: true },
    designation: { type: String, required: true, trim: true, index: true },
    qualification: { type: String, trim: true },
    department: { type: String, required: true, trim: true, index: true },
    reportingManager: { type: String, trim: true },
    branch: { type: String, required: true, trim: true, index: true },
    division: { type: String, trim: true },
    salaryStructure: { type: String, trim: true },
    bank: {
      account: { type: String, trim: true },
      name: { type: String, trim: true },
      ifsc: { type: String, trim: true, uppercase: true },
    },
    address: {
      line1: { type: String, trim: true },
      line2: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      zip: { type: String, trim: true },
    },
    email: { type: String, trim: true, lowercase: true, index: true },
    stdCode: { type: String, trim: true },
    phone: { type: String, trim: true },
    mobile: { type: String, trim: true },
    dateOfJoining: { type: Date, required: true },
    salaryFrom: { type: Date },
    leavingDate: { type: Date },
    leavingReason: { type: String, trim: true },
    esi: {
      applicable: { type: Boolean, default: false },
      number: { type: String, trim: true },
      dispensary: { type: String, trim: true },
    },
    pf: {
      applicable: { type: Boolean, default: false },
      number: { type: String, trim: true },
      fileNumber: { type: String, trim: true },
      uan: { type: String, trim: true },
      restrictPF: { type: Boolean, default: false },
      zeroPension: { type: Boolean, default: false },
    },
    zeroPT: { type: Boolean, default: false },
    pan: { type: String, trim: true, uppercase: true },
    wardCircle: { type: String, trim: true },
    director: { type: String, trim: true },
    aadhar: { type: String, trim: true },
    remarks: { type: String, trim: true },
    rejoinee: { type: Boolean, default: false },
    previousEmpId: { type: String, trim: true },
    experience: { type: String, trim: true },
    status: { type: String, enum: EMPLOYEE_STATUSES, default: 'Active' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

employeeSchema.pre('validate', async function autoEmpId() {
  if (!this.empId) {
    const count = await this.constructor.countDocuments();
    this.empId = `EMP-${String(count + 1).padStart(4, '0')}`;
  } else {
    this.empId = this.empId.toUpperCase();
  }
});

employeeSchema.add({
  hourlyRate: { type: Number, min: 0, default: 0 },
});

export const Employee =
  mongoose.models.Employee ?? mongoose.model('Employee', employeeSchema);
