"use client";

import { useState } from "react";
import {
  Plus,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  X,
  FileText,
  Package,
  Mail,
  Bell,
  ShieldAlert,
} from "lucide-react";
import { useTenantAuth } from "@/hooks/useTenantAuth";
import { useFinance } from "@/hooks/useFinance";
import { useProjects } from "@/hooks/useProjects";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Payment } from "@/lib/services/invoiceService";
import type { VendorPayment } from "@/lib/services/vendorBillService";

const INVOICE_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  partial: "bg-amber-100 text-amber-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
};

const BILL_STATUS_COLORS: Record<string, string> = {
  pending: "bg-orange-100 text-orange-700",
  partial: "bg-amber-100 text-amber-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
};

const AGING_LABELS: Record<string, string> = {
  current: "0-30 days",
  "31-60": "31-60 days",
  "61-90": "61-90 days",
  "90+": "90+ days",
};

const PAYMENT_METHODS: Payment["method"][] = ["cash", "bank_transfer", "upi", "cheque", "card", "other"];

export default function FinancePage() {
  const { tenant } = useTenantAuth();
  const tenantId = tenant?.id || null;
  const currentUser = useCurrentUser();
  const {
    invoices,
    vendorBills,
    stats,
    loading,
    createInvoice,
    updateInvoiceStatus,
    recordInvoicePayment,
    createVendorBill,
    recordVendorPayment,
    sendPaymentReminder,
  } = useFinance(tenantId);
  const { projects } = useProjects(tenantId);

  // Create Invoice dialog
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    projectId: "",
    clientName: "",
    amount: "",
    dueDate: "",
    description: "",
  });
  const [invoiceError, setInvoiceError] = useState("");

  // Create Vendor Bill dialog
  const [showCreateBill, setShowCreateBill] = useState(false);
  const [billForm, setBillForm] = useState({
    projectId: "",
    vendorName: "",
    amount: "",
    dueDate: "",
    description: "",
  });
  const [billError, setBillError] = useState("");

  // Record Payment dialog
  const [showPayment, setShowPayment] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<{ type: "invoice" | "bill"; id: string; outstanding: number } | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    method: "bank_transfer" as Payment["method"],
    reference: "",
  });
  const [paymentError, setPaymentError] = useState("");

  // Reminder state
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const [sendingBulkReminder, setSendingBulkReminder] = useState(false);

  // Permission check — only Admin (owner) and Accountant can access finance
  const canViewFinance = currentUser.can("view_invoices");
  const canManageInvoices = currentUser.can("manage_invoices");
  const canManageVendorBills = currentUser.can("manage_vendor_bills");

  const formatAmount = (amount: number) => {
    if (!amount) return "₹0";
    return amount >= 100000
      ? `₹${(amount / 100000).toFixed(1)}L`
      : `₹${amount.toLocaleString("en-IN")}`;
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "-";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
  };

  const handleCreateInvoice = async () => {
    if (!invoiceForm.projectId || !invoiceForm.amount || !invoiceForm.dueDate) return;
    setInvoiceError("");
    try {
      const project = projects.find((p) => p.id === invoiceForm.projectId);
      await createInvoice({
        projectId: invoiceForm.projectId,
        clientId: (project as any)?.customerId || "",  // customer Firebase UID (null on pre-Phase-4 projects)
        clientEmail: project?.clientEmail || "",
        clientName: invoiceForm.clientName || project?.clientName || "",
        amount: parseFloat(invoiceForm.amount),
        dueDate: new Date(invoiceForm.dueDate),
        description: invoiceForm.description || undefined,
      });
      setInvoiceForm({ projectId: "", clientName: "", amount: "", dueDate: "", description: "" });
      setShowCreateInvoice(false);
    } catch (err: any) {
      setInvoiceError(err.message || "Failed to create invoice");
    }
  };

  const handleCreateBill = async () => {
    if (!billForm.projectId || !billForm.vendorName || !billForm.amount || !billForm.dueDate) return;
    setBillError("");
    try {
      await createVendorBill({
        projectId: billForm.projectId,
        vendorName: billForm.vendorName,
        amount: parseFloat(billForm.amount),
        dueDate: new Date(billForm.dueDate),
        description: billForm.description || undefined,
      });
      setBillForm({ projectId: "", vendorName: "", amount: "", dueDate: "", description: "" });
      setShowCreateBill(false);
    } catch (err: any) {
      setBillError(err.message || "Failed to create vendor bill");
    }
  };

  const openPaymentDialog = (type: "invoice" | "bill", id: string, amount: number, paidAmount: number) => {
    const outstanding = amount - paidAmount;
    setPaymentTarget({ type, id, outstanding });
    setPaymentForm({ amount: String(outstanding), method: "bank_transfer", reference: "" });
    setPaymentError("");
    setShowPayment(true);
  };

  const handleRecordPayment = async () => {
    if (!paymentTarget || !paymentForm.amount) return;
    setPaymentError("");

    const paymentAmount = parseFloat(paymentForm.amount);

    // Client-side overpayment check
    if (paymentAmount > paymentTarget.outstanding) {
      setPaymentError(`Amount exceeds outstanding balance of ${formatAmount(paymentTarget.outstanding)}`);
      return;
    }
    if (paymentAmount <= 0) {
      setPaymentError("Payment amount must be greater than zero");
      return;
    }

    try {
      const paymentData = {
        amount: paymentAmount,
        paidOn: new Date(),
        method: paymentForm.method as Payment["method"],
        reference: paymentForm.reference || undefined,
        createdBy: currentUser.employeeId || currentUser.firebaseUser?.uid,
      };

      if (paymentTarget.type === "invoice") {
        await recordInvoicePayment(paymentTarget.id, paymentData);
      } else {
        await recordVendorPayment(paymentTarget.id, paymentData);
      }
      setShowPayment(false);
      setPaymentTarget(null);
    } catch (err: any) {
      setPaymentError(err.message || "Payment failed");
    }
  };

  const handleSendReminder = async (type: "invoice" | "bill", id: string) => {
    setSendingReminder(id);
    await sendPaymentReminder({ type, id });
    setSendingReminder(null);
  };

  const handleBulkReminder = async () => {
    setSendingBulkReminder(true);
    await sendPaymentReminder();
    setSendingBulkReminder(false);
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading finance data...</div>;
  }

  // Permission gate
  if (!currentUser.loading && !canViewFinance) {
    return (
      <div className="p-12 text-center">
        <ShieldAlert className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-900">Access Denied</h2>
        <p className="text-sm text-gray-500 mt-1">You don&apos;t have permission to view financial data.</p>
        <p className="text-xs text-gray-400 mt-2">Contact your admin to request access.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finance</h1>
          <p className="text-sm text-gray-500">Track invoices, vendor bills, payments, and cash flow</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkReminder}
            disabled={sendingBulkReminder}
            className="text-xs"
          >
            <Bell className="mr-1.5 h-3.5 w-3.5" />
            {sendingBulkReminder ? "Sending..." : "Send All Reminders"}
          </Button>
          {canManageVendorBills && (
            <Button variant="outline" onClick={() => { setBillError(""); setShowCreateBill(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Vendor Bill
            </Button>
          )}
          {canManageInvoices && (
            <Button className="bg-[#0F172A] hover:bg-[#1E293B] text-white" onClick={() => { setInvoiceError(""); setShowCreateInvoice(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Invoice
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="border-none shadow-sm bg-green-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold text-green-500 uppercase tracking-wider flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Total Receivable
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{formatAmount(stats.totalReceivable)}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-red-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold text-red-400 uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Overdue AR
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatAmount(stats.overdueReceivable)}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-orange-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1">
              <TrendingDown className="h-3 w-3" /> Total Payable
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatAmount(stats.totalPayable)}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-red-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold text-red-400 uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Overdue AP
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatAmount(stats.overduePayable)}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-blue-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1">
              <DollarSign className="h-3 w-3" /> Net Position
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", stats.netPosition >= 0 ? "text-green-700" : "text-red-700")}>
              {formatAmount(stats.netPosition)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="invoices" className="space-y-4">
        <TabsList className="bg-gray-100 p-1">
          <TabsTrigger value="invoices">Invoices ({invoices.length})</TabsTrigger>
          <TabsTrigger value="bills">Vendor Bills ({vendorBills.length})</TabsTrigger>
          <TabsTrigger value="aging">Aging</TabsTrigger>
          <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
        </TabsList>

        {/* Invoices Tab */}
        <TabsContent value="invoices">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardContent className="p-0">
              {invoices.length === 0 ? (
                <div className="p-12 text-center">
                  <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No invoices yet</p>
                  {canManageInvoices && (
                    <Button variant="outline" className="mt-3" onClick={() => setShowCreateInvoice(true)}>
                      <Plus className="mr-2 h-4 w-4" /> Create First Invoice
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/50 hover:bg-transparent">
                      <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Invoice #</TableHead>
                      <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Client</TableHead>
                      <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Amount</TableHead>
                      <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Paid</TableHead>
                      <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Status</TableHead>
                      <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Aging</TableHead>
                      <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Due Date</TableHead>
                      <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono font-medium text-gray-900">{inv.invoiceNumber}</TableCell>
                        <TableCell>
                          <div className="font-medium text-gray-900">{inv.clientName}</div>
                          {inv.description && <div className="text-xs text-gray-500 truncate max-w-[150px]">{inv.description}</div>}
                        </TableCell>
                        <TableCell className="font-bold text-gray-900">{formatAmount(inv.amount)}</TableCell>
                        <TableCell className="text-gray-600">{formatAmount(inv.paidAmount)}</TableCell>
                        <TableCell>
                          <Badge className={cn("text-[10px] capitalize border-none", INVOICE_STATUS_COLORS[inv.status])}>
                            {inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {inv.status !== "paid" && inv.agingBucket && (
                            <span className="text-xs text-gray-500">
                              {AGING_LABELS[inv.agingBucket] || inv.agingBucket}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-gray-500 text-sm">{formatDate(inv.dueDate)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1.5">
                            {inv.status === "draft" && canManageInvoices && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => updateInvoiceStatus(inv.id, "sent")}
                              >
                                Send
                              </Button>
                            )}
                            {inv.status !== "paid" && canManageInvoices && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => openPaymentDialog("invoice", inv.id, inv.amount, inv.paidAmount)}
                              >
                                Record Payment
                              </Button>
                            )}
                            {(inv.status === "overdue" || inv.status === "sent" || inv.status === "partial") && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs text-orange-600 border-orange-200 hover:bg-orange-50"
                                onClick={() => handleSendReminder("invoice", inv.id)}
                                disabled={sendingReminder === inv.id}
                              >
                                <Mail className="h-3 w-3 mr-1" />
                                {sendingReminder === inv.id ? "..." : "Remind"}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vendor Bills Tab */}
        <TabsContent value="bills">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardContent className="p-0">
              {vendorBills.length === 0 ? (
                <div className="p-12 text-center">
                  <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No vendor bills yet</p>
                  {canManageVendorBills && (
                    <Button variant="outline" className="mt-3" onClick={() => setShowCreateBill(true)}>
                      <Plus className="mr-2 h-4 w-4" /> Create First Bill
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/50 hover:bg-transparent">
                      <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Vendor</TableHead>
                      <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Amount</TableHead>
                      <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Paid</TableHead>
                      <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Status</TableHead>
                      <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Aging</TableHead>
                      <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Due Date</TableHead>
                      <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendorBills.map((bill) => (
                      <TableRow key={bill.id}>
                        <TableCell>
                          <div className="font-medium text-gray-900">{bill.vendorName}</div>
                          {bill.description && <div className="text-xs text-gray-500 truncate max-w-[150px]">{bill.description}</div>}
                        </TableCell>
                        <TableCell className="font-bold text-gray-900">{formatAmount(bill.amount)}</TableCell>
                        <TableCell className="text-gray-600">{formatAmount(bill.paidAmount)}</TableCell>
                        <TableCell>
                          <Badge className={cn("text-[10px] capitalize border-none", BILL_STATUS_COLORS[bill.status])}>
                            {bill.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {bill.status !== "paid" && bill.agingBucket && (
                            <span className="text-xs text-gray-500">
                              {AGING_LABELS[bill.agingBucket] || bill.agingBucket}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-gray-500 text-sm">{formatDate(bill.dueDate)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1.5">
                            {bill.status !== "paid" && canManageVendorBills && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => openPaymentDialog("bill", bill.id, bill.amount, bill.paidAmount)}
                              >
                                Record Payment
                              </Button>
                            )}
                            {(bill.status === "overdue" || bill.status === "pending" || bill.status === "partial") && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs text-orange-600 border-orange-200 hover:bg-orange-50"
                                onClick={() => handleSendReminder("bill", bill.id)}
                                disabled={sendingReminder === bill.id}
                              >
                                <Mail className="h-3 w-3 mr-1" />
                                {sendingReminder === bill.id ? "..." : "Remind"}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aging Tab */}
        <TabsContent value="aging">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Receivable Aging */}
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-bold text-gray-700">Receivable Aging</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Bucket</TableHead>
                      <TableHead className="text-[10px] font-bold text-gray-400 uppercase text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="text-sm text-gray-700">Current (0-30 days)</TableCell>
                      <TableCell className="text-sm font-bold text-gray-900 text-right">{formatAmount(stats.receivableAging.current)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-sm text-gray-700">31-60 days</TableCell>
                      <TableCell className="text-sm font-bold text-amber-700 text-right">{formatAmount(stats.receivableAging.thirtyOne)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-sm text-gray-700">61-90 days</TableCell>
                      <TableCell className="text-sm font-bold text-orange-700 text-right">{formatAmount(stats.receivableAging.sixtyOne)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-sm text-gray-700">90+ days</TableCell>
                      <TableCell className="text-sm font-bold text-red-700 text-right">{formatAmount(stats.receivableAging.ninetyPlus)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Payable Aging */}
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-bold text-gray-700">Payable Aging</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Bucket</TableHead>
                      <TableHead className="text-[10px] font-bold text-gray-400 uppercase text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="text-sm text-gray-700">Current (0-30 days)</TableCell>
                      <TableCell className="text-sm font-bold text-gray-900 text-right">{formatAmount(stats.payableAging.current)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-sm text-gray-700">31-60 days</TableCell>
                      <TableCell className="text-sm font-bold text-amber-700 text-right">{formatAmount(stats.payableAging.thirtyOne)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-sm text-gray-700">61-90 days</TableCell>
                      <TableCell className="text-sm font-bold text-orange-700 text-right">{formatAmount(stats.payableAging.sixtyOne)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-sm text-gray-700">90+ days</TableCell>
                      <TableCell className="text-sm font-bold text-red-700 text-right">{formatAmount(stats.payableAging.ninetyPlus)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Cashflow Tab */}
        <TabsContent value="cashflow">
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-none shadow-sm bg-green-50">
                <CardContent className="p-6">
                  <p className="text-xs text-green-600 uppercase font-bold tracking-wider mb-2">Total Receivable</p>
                  <p className="text-3xl font-bold text-green-800">{formatAmount(stats.totalReceivable)}</p>
                  <p className="text-xs text-green-600 mt-1">{invoices.filter((i) => i.status !== "paid").length} outstanding invoices</p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm bg-orange-50">
                <CardContent className="p-6">
                  <p className="text-xs text-orange-600 uppercase font-bold tracking-wider mb-2">Total Payable</p>
                  <p className="text-3xl font-bold text-orange-800">{formatAmount(stats.totalPayable)}</p>
                  <p className="text-xs text-orange-600 mt-1">{vendorBills.filter((b) => b.status !== "paid").length} outstanding bills</p>
                </CardContent>
              </Card>
              <Card className={cn("border-none shadow-sm", stats.netPosition >= 0 ? "bg-blue-50" : "bg-red-50")}>
                <CardContent className="p-6">
                  <p className={cn("text-xs uppercase font-bold tracking-wider mb-2", stats.netPosition >= 0 ? "text-blue-600" : "text-red-600")}>
                    Net Position
                  </p>
                  <p className={cn("text-3xl font-bold", stats.netPosition >= 0 ? "text-blue-800" : "text-red-800")}>
                    {formatAmount(stats.netPosition)}
                  </p>
                  <p className={cn("text-xs mt-1", stats.netPosition >= 0 ? "text-blue-600" : "text-red-600")}>
                    {stats.netPosition >= 0 ? "Positive cash position" : "Negative cash position"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Overdue Summary */}
            {(stats.overdueReceivable > 0 || stats.overduePayable > 0) && (
              <Card className="border-none shadow-sm bg-red-50/50">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    <div>
                      <p className="text-sm font-medium text-red-900">Overdue Amounts</p>
                      <p className="text-sm text-red-700">
                        {stats.overdueReceivable > 0 && <span>{formatAmount(stats.overdueReceivable)} in overdue receivables</span>}
                        {stats.overdueReceivable > 0 && stats.overduePayable > 0 && " | "}
                        {stats.overduePayable > 0 && <span>{formatAmount(stats.overduePayable)} in overdue payables</span>}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Invoice Dialog */}
      <Dialog open={showCreateInvoice} onOpenChange={setShowCreateInvoice}>
        <DialogContent className="max-w-md">
          <div className="space-y-4 p-4">
            <h3 className="font-semibold text-gray-900">Create Invoice</h3>
            {invoiceError && (
              <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{invoiceError}</div>
            )}
            <Select
              value={invoiceForm.projectId}
              onValueChange={(val) => {
                const p = projects.find((pr) => pr.id === val);
                setInvoiceForm({ ...invoiceForm, projectId: val, clientName: p?.clientName || "" });
              }}
            >
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Select Project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.projectName || `${p.clientName} - Project`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Client Name"
              value={invoiceForm.clientName}
              onChange={(e) => setInvoiceForm({ ...invoiceForm, clientName: e.target.value })}
            />
            <Input
              type="number"
              placeholder="Amount (₹)"
              value={invoiceForm.amount}
              onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })}
            />
            <Input
              type="date"
              placeholder="Due Date"
              value={invoiceForm.dueDate}
              onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })}
            />
            <Input
              placeholder="Description (optional)"
              value={invoiceForm.description}
              onChange={(e) => setInvoiceForm({ ...invoiceForm, description: e.target.value })}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowCreateInvoice(false)}>Cancel</Button>
              <Button className="bg-[#0F172A]" onClick={handleCreateInvoice}>Create Invoice</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Vendor Bill Dialog */}
      <Dialog open={showCreateBill} onOpenChange={setShowCreateBill}>
        <DialogContent className="max-w-md">
          <div className="space-y-4 p-4">
            <h3 className="font-semibold text-gray-900">Create Vendor Bill</h3>
            {billError && (
              <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{billError}</div>
            )}
            <Select
              value={billForm.projectId}
              onValueChange={(val) => setBillForm({ ...billForm, projectId: val })}
            >
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Select Project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.projectName || `${p.clientName} - Project`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Vendor Name"
              value={billForm.vendorName}
              onChange={(e) => setBillForm({ ...billForm, vendorName: e.target.value })}
            />
            <Input
              type="number"
              placeholder="Amount (₹)"
              value={billForm.amount}
              onChange={(e) => setBillForm({ ...billForm, amount: e.target.value })}
            />
            <Input
              type="date"
              placeholder="Due Date"
              value={billForm.dueDate}
              onChange={(e) => setBillForm({ ...billForm, dueDate: e.target.value })}
            />
            <Input
              placeholder="Description (optional)"
              value={billForm.description}
              onChange={(e) => setBillForm({ ...billForm, description: e.target.value })}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowCreateBill(false)}>Cancel</Button>
              <Button className="bg-[#0F172A]" onClick={handleCreateBill}>Create Bill</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="max-w-sm">
          <div className="space-y-4 p-4">
            <h3 className="font-semibold text-gray-900">Record Payment</h3>
            {paymentTarget && (
              <p className="text-sm text-gray-500">Outstanding: {formatAmount(paymentTarget.outstanding)}</p>
            )}
            {paymentError && (
              <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{paymentError}</div>
            )}
            <Input
              type="number"
              placeholder="Payment Amount (₹)"
              value={paymentForm.amount}
              onChange={(e) => {
                setPaymentForm({ ...paymentForm, amount: e.target.value });
                setPaymentError("");
              }}
            />
            <Select
              value={paymentForm.method}
              onValueChange={(val) => setPaymentForm({ ...paymentForm, method: val as Payment["method"] })}
            >
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m} className="capitalize">{m.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Reference # (optional)"
              value={paymentForm.reference}
              onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowPayment(false)}>Cancel</Button>
              <Button className="bg-[#0F172A]" onClick={handleRecordPayment}>Record Payment</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
