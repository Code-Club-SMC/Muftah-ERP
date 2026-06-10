import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db";
import { employees, salaryRevisions } from "@/db/schemas/hr-schema";
import { salesmen, orderBookers } from "@/db/schemas/sales-erp-schema";
import { eq } from "drizzle-orm";
import { updateEmployeeSchema } from "@/lib/validators/hr-validators";
import { requireHrManageMiddleware } from "@/lib/middlewares";

export const updateEmployeeFn = createServerFn()
  .middleware([requireHrManageMiddleware])
  .inputValidator(updateEmployeeSchema)
  .handler(async ({ data, context }) => {
    const { id, ...updateData } = data;

    return await db.transaction(async (tx) => {
      // Fetch existing employee to check flag changes and salary changes
      const existing = await tx.query.employees.findFirst({
        where: eq(employees.id, id),
      });

      const salaryChanged =
        existing &&
        (existing.basicSalary !== (updateData.basicSalary || "0") ||
          JSON.stringify(existing.allowanceConfig) !==
            JSON.stringify(updateData.allowanceConfig));

      const [updatedEmployee] = await tx
        .update(employees)
        .set({
          firstName: updateData.firstName,
          lastName: updateData.lastName,
          employeeCode: updateData.employeeCode,
          designation: updateData.designation,
          department: updateData.department,
          joiningDate: updateData.joiningDate,
          status: updateData.status as
            | "active"
            | "on_leave"
            | "terminated"
            | "resigned",
          employmentType: updateData.employmentType as
            | "full_time"
            | "part_time"
            | "contract"
            | "intern",
          phone: updateData.phone,
          cnic: updateData.cnic,
          address: updateData.address,
          bankName: updateData.bankName,
          bankAccountNumber: updateData.bankAccountNumber,
          restDays: updateData.restDays ?? [0],
          standardDutyHours: updateData.standardDutyHours,
          basicSalary: updateData.basicSalary || "0",
          isOrderBooker: updateData.isOrderBooker ?? false,
          isSalesman: updateData.isSalesman ?? false,
          allowanceConfig: updateData.allowanceConfig,
        })
        .where(eq(employees.id, id))
        .returning();

      // Record salary revision if salary or allowances changed
      if (salaryChanged) {
        const oldSalary = parseFloat(existing!.basicSalary || "0");
        const newSalary = parseFloat(updateData.basicSalary || "0");
        const salaryDiff = newSalary - oldSalary;

        await tx.insert(salaryRevisions).values({
          employeeId: id,
          revisionDate: new Date().toISOString().split("T")[0],
          basicSalary: updateData.basicSalary || "0",
          allowanceConfig: updateData.allowanceConfig || [],
          reason: `Salary update: PKR ${oldSalary.toLocaleString()} → PKR ${newSalary.toLocaleString()} (${salaryDiff >= 0 ? "+" : ""}${salaryDiff.toLocaleString()})`,
          changedById: context.session.user.id,
        });
      }

      const fullName = `${updateData.firstName} ${updateData.lastName}`.trim();

      // Sync salesman record
      if (updateData.isSalesman) {
        const existingSalesman = await tx.query.salesmen.findFirst({
          where: eq(salesmen.employeeId, id),
        });
        if (existingSalesman) {
          await tx
            .update(salesmen)
            .set({
              name: fullName,
              phone: updateData.phone || existingSalesman.phone,
              status: "active",
            })
            .where(eq(salesmen.id, existingSalesman.id));
        } else {
          await tx.insert(salesmen).values({
            name: fullName,
            phone: updateData.phone || undefined,
            employeeId: id,
          });
        }
      } else if (existing?.isSalesman && !updateData.isSalesman) {
        // Flag turned off — deactivate linked salesman
        const existingSalesman = await tx.query.salesmen.findFirst({
          where: eq(salesmen.employeeId, id),
        });
        if (existingSalesman) {
          await tx
            .update(salesmen)
            .set({ status: "inactive" })
            .where(eq(salesmen.id, existingSalesman.id));
        }
      }

      // Sync order booker record
      if (updateData.isOrderBooker) {
        const existingOB = await tx.query.orderBookers.findFirst({
          where: eq(orderBookers.employeeId, id),
        });
        if (existingOB) {
          await tx
            .update(orderBookers)
            .set({
              name: fullName,
              phone: updateData.phone || existingOB.phone,
              address: updateData.address || existingOB.address,
              status: "active",
            })
            .where(eq(orderBookers.id, existingOB.id));
        } else {
          await tx.insert(orderBookers).values({
            name: fullName,
            phone: updateData.phone || undefined,
            address: updateData.address || undefined,
            employeeId: id,
          });
        }
      } else if (existing?.isOrderBooker && !updateData.isOrderBooker) {
        // Flag turned off — deactivate linked order booker
        const existingOB = await tx.query.orderBookers.findFirst({
          where: eq(orderBookers.employeeId, id),
        });
        if (existingOB) {
          await tx
            .update(orderBookers)
            .set({ status: "inactive" })
            .where(eq(orderBookers.id, existingOB.id));
        }
      }

      return updatedEmployee;
    });
  });