import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db";
import { requireReportsViewMiddleware } from "@/lib/middlewares";
import { payslips, payrolls, employees } from "@/db/schemas/hr-schema";
import { z } from "zod";
import { and, eq, gte, lte, sql, desc } from "drizzle-orm";
import { parseISO, isValid, endOfDay } from "date-fns";

export const getSalariesReportFn = createServerFn()
  .middleware([requireReportsViewMiddleware])
  .inputValidator((input: any) =>
    z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const conditions = [];

    if (data.dateFrom) {
      const from = parseISO(data.dateFrom);
      if (isValid(from)) conditions.push(gte(payrolls.paidAt, from));
    }
    if (data.dateTo) {
      const to = parseISO(data.dateTo);
      if (isValid(to)) conditions.push(lte(payrolls.paidAt, endOfDay(to)));
    }

    const rows = await db
      .select({
        payslipId: payslips.id,
        employeeName: sql<string>`${employees.firstName} || ' ' || ${employees.lastName}`,
        employeeCode: employees.employeeCode,
        designation: employees.designation,
        department: employees.department,
        payrollMonth: payrolls.month,
        daysPresent: payslips.daysPresent,
        daysAbsent: payslips.daysAbsent,
        daysLeave: payslips.daysLeave,
        basicSalary: payslips.basicSalary,
        incentiveAmount: payslips.incentiveAmount,
        commissionAmount: payslips.commissionAmount,
        overtimeAmount: payslips.overtimeAmount,
        nightShiftAllowanceAmount: payslips.nightShiftAllowanceAmount,
        bonusAmount: payslips.bonusAmount,
        grossSalary: payslips.grossSalary,
        absentDeduction: payslips.absentDeduction,
        leaveDeduction: payslips.leaveDeduction,
        advanceDeduction: payslips.advanceDeduction,
        taxDeduction: payslips.taxDeduction,
        otherDeduction: payslips.otherDeduction,
        totalDeductions: payslips.totalDeductions,
        netSalary: payslips.netSalary,
        arrearsAmount: payslips.arrearsAmount,
        paidAt: payrolls.paidAt,
      })
      .from(payslips)
      .innerJoin(payrolls, eq(payslips.payrollId, payrolls.id))
      .innerJoin(employees, eq(payslips.employeeId, employees.id))
      .where(and(...conditions))
      .orderBy(desc(payrolls.paidAt));

    const totalGross = rows.reduce((s, r) => s + Number(r.grossSalary), 0);
    const totalDeductions = rows.reduce((s, r) => s + Number(r.totalDeductions), 0);
    const totalNet = rows.reduce((s, r) => s + Number(r.netSalary), 0);
    const totalArrears = rows.reduce((s, r) => s + Number(r.arrearsAmount), 0);

    return {
      payslips: rows.map((r) => ({
        ...r,
        basicSalary: Number(r.basicSalary),
        incentiveAmount: Number(r.incentiveAmount),
        overtimeAmount: Number(r.overtimeAmount),
        nightShiftAllowanceAmount: Number(r.nightShiftAllowanceAmount),
        bonusAmount: Number(r.bonusAmount),
        grossSalary: Number(r.grossSalary),
        absentDeduction: Number(r.absentDeduction),
        leaveDeduction: Number(r.leaveDeduction),
        advanceDeduction: Number(r.advanceDeduction),
        taxDeduction: Number(r.taxDeduction),
        otherDeduction: Number(r.otherDeduction),
        totalDeductions: Number(r.totalDeductions),
        netSalary: Number(r.netSalary),
        arrearsAmount: Number(r.arrearsAmount),
      })),
      summary: { totalGross, totalDeductions, totalNet, totalArrears, count: rows.length },
    };
  });
