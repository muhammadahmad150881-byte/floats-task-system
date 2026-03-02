window.SUPABASE_URL = "https://gzrlsrljpknelxuijepf.supabase.co";
window.SUPABASE_ANON_KEY =
  "sb_publishable_ylV32qKZMJScjYG5a3eteQ_bTIDrZ5w";

window.supabase = supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY
);


/**************************************************
 * CORE APP LOGIC — DO NOT MODIFY
 **************************************************/



/* =========================
   GLOBAL SESSION STATE
========================= */
let currentUserRole = null;
let currentUsername = null;
let myTasksCache = [];
let serviceUsersCache = [];
let staffDashboardChart = null;
let adminPieChart = null;
let adminTrendChart = null;
let adminStaffPerformanceChart = null;



/* =========================
   INITIAL STATE
========================= */
document.getElementById("appContainer").style.display = "none";
document.getElementById("loginScreen").style.display = "block";
document.getElementById("menuBtn").style.display = "none";

/* =========================
   LOGIN
========================= */
window.loginUser = async function () {
  const input = document.getElementById("loginUser").value.trim();
  const pass = document.getElementById("loginPass").value.trim();

  document.getElementById("loginError").style.display = "none";

  const { data: users, error } = await supabase
    .from("users")
    .select("*")
    .eq("username", input)
    .limit(1);

  if (error) {
    console.error(error);
    alert("Database error");
    return;
  }

  if (!users || users.length === 0) {
    document.getElementById("loginError").style.display = "block";
    return;
  }

  const user = users[0];

  if (user.password !== pass) {
    document.getElementById("loginError").style.display = "block";
    return;
  }

  // ✅ SAVE SESSION STATE (THIS WAS MISSING)
  currentUsername = user.username;
  currentUserRole = user.role;
  window.currentUserPermissions = user.permissions || {};
  window.currentUserId = user.id;

  // ✅ UI SWITCH
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("appContainer").style.display = "block";
  document.getElementById("menuBtn").style.display = "inline-block";

  // ✅ ROUTING
  hideAllPanels();

  if (user.role === "Admin") {
    openAdminDashboard();
  } else {
    openStaffDashboard();
    applyStaffPermissions(user);
    applyARMVisibilityForStaff();
  }
  await checkInvoicingAccess();
};


function loginUserInput() {
  return document.getElementById("loginUser").value.trim();
}

function loginPassInput() {
  return document.getElementById("loginPass").value.trim();
}

/* =========================
   LOGOUT
========================= */
function logoutUser() {
  currentUserRole = null;
  currentUsername = null;
  closeAllMenus();
  document.getElementById("appContainer").style.display = "none";
  document.getElementById("loginScreen").style.display = "block";
  document.getElementById("menuBtn").style.display = "none";
}


/* =========================
   MENU CONTROLS
========================= */
function toggleMenu() {
  if (currentUserRole === "Admin") {
    rightSidebar.classList.toggle("open");
    staffMenuPanel.style.display = "none";
  } else {
    staffMenuPanel.style.display =
      staffMenuPanel.style.display === "block" ? "none" : "block";
  }
}

function closeAllMenus() {
  rightSidebar.classList.remove("open");
  staffMenuPanel.style.display = "none";
}

function toggleAssignSubMenu() {
  assignSubMenu.style.display =
    assignSubMenu.style.display === "block" ? "none" : "block";
}

function toggleManageTeamSubMenu() {
  manageTeamSubMenu.style.display =
    manageTeamSubMenu.style.display === "block" ? "none" : "block";
}

/**************************************************
 * TEAM MEMBER LOGIC
 **************************************************/

function openAddTeamMemberForm() {
  closeAllMenus();
  hideAllPanels();
  addTeamMemberForm.style.display = "block";
}

function cancelAddTeamMember() {
  restoreDashboard();
}


async function saveTeamMemberNew() {
  if (!tmFullName.value || !tmUsername.value || !tmPassword.value) {
    alert("Required fields missing");
    return;
  }

  const username = tmUsername.value.trim();

  // 🔒 Check duplicate username (same logic as before)
  const { data: existing, error: checkError } = await supabase
    .from("users")
    .select("id")
    .eq("username", username)
    .limit(1);

  if (checkError) {
    console.error(checkError);
    alert("Error checking username");
    return;
  }

  if (existing.length > 0) {
    alert("Username already exists");
    return;
  }

  // ➕ Insert new user
  const { error: insertError } = await supabase
    .from("users")
    .insert([{
      name: tmFullName.value.trim(),
      username: username,
      email: tmEmail.value.trim() || null,
      password: tmPassword.value,
      role: tmRole.value,
      created_at: new Date().toISOString()
    }]);

  if (insertError) {
    console.error(insertError);
    alert("Failed to add team member");
    return;
  }

alert("Team member added");
restoreDashboard(); // ✅ THIS FIXES THE ISSUE
}


/**************************************************
 * SERVICE USER LOGIC (FIXED & STABLE)
 **************************************************/
function openAddServiceUserForm() {
  if (!hasPermission("addServiceUser")) {
    alert("Access denied");
    return;
  }

  closeAllMenus();
  hideAllPanels();
  existingSuActions.style.display = "none";
  addServiceUserForm.style.display = "block";

  // ✅ default effective month = current month
  const today = new Date();
  document.getElementById("suEffectiveMonth").value =
    today.getFullYear() + "-" +
    String(today.getMonth() + 1).padStart(2, "0");
}

function cancelAddServiceUser() {
  restoreDashboard();
}


/* 🔒 FIXED EXISTENCE CHECK */
async function checkExistingServiceUser() {

  const suid = document.getElementById("suIdInput").value.trim().toUpperCase();
  if (!suid) return;

  const { data, error } = await supabase
    .from("service_users")
    .select("*")
    .eq("suid", suid)
    .maybeSingle();   // 🔥 IMPORTANT FIX

  // If real DB error
  if (error) {
    console.error(error);
    return;
  }

  // If user not found
  if (!data) {
    document.getElementById("existingSuActions").style.display = "none";
    return;
  }

  const user = data;

  // 🔥 AUTO-FILL FIELDS (MATCHING YOUR DB COLUMNS)

  document.getElementById("suPropertyIdInput").value =
    user.propertyid || "";

  document.getElementById("suLineManagerInput").value =
    user.linemanager || "";

  document.getElementById("suAreaManagerInput").value =
    user.areamanager || "";

  document.getElementById("suEffectiveMonth").value =
    user.effectivefrommonth || "";

  document.getElementById("suFullNameInput").value =
    user.fullName || "";

  // Show existing user section
  document.getElementById("existingSuActions").style.display = "block";

  // 🔹 Fetch latest budget
  const { data: budgetData } = await supabase
    .from("service_user_budgets")
    .select("*")
    .eq("suid", suid)
    .order("valid_from", { ascending: false })
    .limit(1);

  if (budgetData && budgetData.length > 0) {

    const budget = budgetData[0];

    document.getElementById("suTotalBudget").value =
      budget.total_budget || "";

    document.getElementById("suDailyAllowance").value =
      budget.daily_allowance || "";

    document.getElementById("suWeeklyAllowance").value =
      budget.weekly_allowance || "";

    document.getElementById("suBudgetFrom").value =
      budget.valid_from || "";

    document.getElementById("suBudgetThrough").value =
      budget.valid_through || "";
  }
}


/* ✅ SAVE (NO FALSE POSITIVES) */
async function saveServiceUser() {

  const suid = document.getElementById("suIdInput").value.trim().toUpperCase();
  const fullName = document.getElementById("suFullNameInput").value.trim();
  const propertyid = document.getElementById("suPropertyIdInput").value.trim();
  const linemanager = document.getElementById("suLineManagerInput").value.trim();
  const areamanager = document.getElementById("suAreaManagerInput").value.trim();
  const effectivefrommonth = document.getElementById("suEffectiveMonth").value;

  const totalBudget = document.getElementById("suTotalBudget").value;
  const daily = document.getElementById("suDailyAllowance").value;
  const weekly = document.getElementById("suWeeklyAllowance").value;
  const validFrom = document.getElementById("suBudgetFrom").value;
  const validThrough = document.getElementById("suBudgetThrough").value;

  if (!suid || !propertyid || !fullName) {
    alert("SUID, Full Name and Property ID are required.");
    return;
  }

  // 🔹 UPSERT SERVICE USER
  const { error: userError } = await supabase
    .from("service_users")
    .upsert([{
      suid,
      fullName, // ✅ EXACT MATCH
      propertyid,
      linemanager,
      areamanager,
      effectivefrommonth,
      active: true
    }], { onConflict: "suid" });

  if (userError) {
    console.error(userError);
    alert("Error saving service user.");
    return;
  }

  // 🔹 HANDLE BUDGET
  if (totalBudget && validFrom && validThrough) {

    const { data: existingBudget } = await supabase
      .from("service_user_budgets")
      .select("id")
      .eq("suid", suid)
      .eq("valid_from", validFrom)
      .maybeSingle();

    if (existingBudget) {

      await supabase
        .from("service_user_budgets")
        .update({
          total_budget: Number(totalBudget),
          daily_allowance: Number(daily),
          weekly_allowance: Number(weekly),
          valid_through: validThrough
        })
        .eq("id", existingBudget.id);

    } else {

      await supabase
        .from("service_user_budgets")
        .insert([{
          suid,
          total_budget: Number(totalBudget),
          daily_allowance: Number(daily),
          weekly_allowance: Number(weekly),
          valid_from: validFrom,
          valid_through: validThrough
        }]);
    }
  }

  alert("Service user saved successfully.");
}


/* ❌ DELETE */
async function deleteServiceUser() {
  const suid = document.getElementById("suIdInput").value.trim().toUpperCase();

  if (!suid) return;

  if (!confirm(`Delete Service User ${suid}?`)) return;

  const { error } = await supabase
    .from("service_users")
    .delete()
    .eq("suid", suid);

  if (error) {
    console.error(error);
    alert("Failed to delete Service User");
    return;
  }

  alert("Service User deleted");
  addServiceUserForm.style.display = "none";
}


/* 💤 INACTIVE */
async function markServiceUserInactive() {
  const suid = document.getElementById("suIdInput").value.trim().toUpperCase();

  if (!suid) return;

  if (!confirm(`Mark Service User ${suid} as inactive?`)) return;

  const { error } = await supabase
    .from("service_users")
    .update({ active: false })
    .eq("suid", suid);

  if (error) {
    console.error(error);
    alert("Failed to mark Service User inactive");
    return;
  }

  alert("Service User marked inactive");
  addServiceUserForm.style.display = "none";
}


/* 🏠 AUTO-FILL LM & AM BY PR */
async function autoFillManagersByPR() {
  const prid = suPropertyIdInput.value.trim();

  if (!prid) {
    suLineManagerInput.readOnly = false;
    suAreaManagerInput.readOnly = false;
    return;
  }

  const { data, error } = await supabase
    .from("service_users")
    .select("linemanager, areamanager")
    .eq("propertyid", prid)
    .eq("active", true)
    .limit(1)
    .single();

  if (error || !data) {
    suLineManagerInput.readOnly = false;
    suAreaManagerInput.readOnly = false;
    return;
  }

  suLineManagerInput.value = data.linemanager || "";
  suAreaManagerInput.value = data.areamanager || "";

  suLineManagerInput.readOnly = true;
  suAreaManagerInput.readOnly = true;
}

/**************************************************
 * OPEN UPDATE LM & AM FORM
 **************************************************/
function openAddManagersForm() {
  if (!hasPermission("updateManagers")) {
    alert("Access denied");
    return;
  }

  closeAllMenus();
  hideAllPanels();
  document.getElementById("addManagersForm").style.display = "block";
}

/**************************************************
 * HELPERS
 **************************************************/
function restoreDashboard() {
  hideAllPanels();     // 🔥 now hides EVERYTHING
  closeAllMenus();
  window.scrollTo(0, 0);

  if (currentUserRole === "Admin") {
    openAdminDashboard();
  } else {
    openStaffDashboard();
  }
}



async function getAssignmentStatsForMonth(month) {
  /* =========================
     LOAD DATA FROM SUPABASE
  ========================= */
  const [
    { data: serviceUsers, error: suError },
    { data: assignments, error: asgError }
  ] = await Promise.all([
    supabase
      .from("service_users")
      .select("suid, active, effectivefrommonth"),

 supabase
  .from("sufp_assignments")
  .select("suid, month")
  .eq("month", month)

  ]);

  if (suError || asgError) {
    console.error(suError || asgError);
    return {
      total: 0,
      alreadyAssigned: 0,
      newUsers: 0
    };
  }

  /* =========================
     SAME LOGIC AS BEFORE
  ========================= */
  const activeServiceUsers = (serviceUsers || []).filter(
    su =>
      su.active &&
      (!su.effectivefrommonth || su.effectivefrommonth <= month)
  );

  const assignedSUIds = new Set(
    (assignments || []).map(a => a.suid)
  );

  const alreadyAssigned = assignedSUIds.size;

  const newUsers = activeServiceUsers.filter(
    su => !assignedSUIds.has(su.suid)
  ).length;

  return {
    total: activeServiceUsers.length,
    alreadyAssigned,
    newUsers
  };
}


async function openSUFPDetail(suid, month, type) {
  hideAllPanels();

  // store context
  document.getElementById("sufpDetailSUID").value = suid;
  document.getElementById("sufpDetailMonth").value = month;
  document.getElementById("sufpDetailType").value = type;

  // reset fields
  document.getElementById("sufpStatus").value = "";
  document.getElementById("sufpMalNumber").value = "";
  document.getElementById("sufpVerifiedAmount").value = "";
  document.getElementById("sufpComments").value = "";

  /* =========================
     LOAD SUFP DETAIL
  ========================= */
  const { data: detail, error: detailError } = await supabase
    .from("sufp_task_details")
    .select("*")
    .eq("suid", suid)
    .eq("month", month)
    .eq("type", type)
    .single();

  if (detailError && detailError.code !== "PGRST116") {
    console.error(detailError);
  }

  if (detail) {
    document.getElementById("sufpStatus").value = detail.status || "";
    document.getElementById("sufpMalNumber").value = detail.mal_number || "";
    document.getElementById("sufpVerifiedAmount").value =
     detail.verified_amount ?? "";
    document.getElementById("sufpComments").value =
      detail.comments || "";

    setSUFPReadOnly(true);
  } else {
    setSUFPReadOnly(false);
  }

  /* =========================
     LOAD SERVICE USER
  ========================= */
  const { data: su } = await supabase
    .from("service_users")
    .select("*")
    .eq("suid", suid)
    .single();

  const serviceUser = su || {};

  /* =========================
     LOAD MANAGERS (BY MONTH)
  ========================= */
  const mgr =
    (await getManagersForPRByMonth(serviceUser.propertyid, month)) ||
    serviceUser;

  // populate labels
  document.getElementById("sufpDetailSUIDText").innerText = suid;
  document.getElementById("sufpDetailName").innerText =
    serviceUser.fullName || "-";
  document.getElementById("sufpDetailPR").innerText =
    serviceUser.propertyid || "-";
  document.getElementById("sufpDetailLM").innerText =
    mgr.linemanager || "-";
  document.getElementById("sufpDetailAM").innerText =
    mgr.areamanager || "-";
    /* =========================
     LOAD DAILY & WEEKLY ALLOWANCE
  ========================= */

  const { data: budgetData, error: budgetError } = await supabase
    .from("service_user_budgets")
    .select("daily_allowance, weekly_allowance")
    .eq("suid", suid)
    .order("valid_from", { ascending: false })
    .limit(1);

  if (budgetError) {
    console.error("Budget fetch error:", budgetError);
  }

  const budget = budgetData?.[0];

  function formatCurrency(val) {
    return val != null
      ? "£" + Number(val).toLocaleString("en-GB", {
          minimumFractionDigits: 2
        })
      : "-";
  }

  document.getElementById("sufpDetailDaily").innerText =
    formatCurrency(budget?.daily_allowance);

  document.getElementById("sufpDetailWeekly").innerText =
    formatCurrency(budget?.weekly_allowance);

  document.getElementById("sufpDetailForm").style.display = "block";
}


function goBackToDashboard() {
  restoreDashboard();
}



function hideAllPanels() {
  document
    .querySelectorAll(".content-panel")
    .forEach(panel => {
      panel.style.display = "none";
    });
}

function hasPermission(permissionKey) {
  if (currentUserRole === "Admin") return true;
  if (!window.currentUserPermissions) return false;

  return !!window.currentUserPermissions[permissionKey];
}


async function getAssignedMonths() {
  const { data, error } = await supabase
    .from("sufp_assignments")
    .select("month");

  if (error) {
    console.error("Failed to load assigned months:", error);
    return [];
  }

  return [...new Set((data || []).map(a => a.month))];
}

async function getMFRStatus(prid, month) {
  if (!prid || !month) return false;

  const { data, error } = await supabase
    .from("data_submissions")
    .select("mfr")
    .eq("prid", prid)
    .eq("month", month)
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Failed to load MFR status:", error);
    return false;
  }

  return data ? data.mfr === true : false;
}

function getUploadedMFRFileMeta(prid, month) {
  const fileInput = document.getElementById("dsMFRFile");
  const file = fileInput.files[0];

  if (!file) return null;

  const ext = file.name.split(".").pop().toLowerCase();

  return {
    systemName: `${prid}_MFR_${month}.${ext}`,
    originalName: file.name,
    size: file.size,
    type: file.type,
    uploadedAt: new Date().toISOString()
  };
}
function closeDSDetail() {
  const month = document.getElementById("dsDetailMonth").value;

  // close detail form
  document.getElementById("dsDetailForm").style.display = "none";

  // reopen list
  document.getElementById("dataSubmissionPanel").style.display = "block";

  // restore month
  document.getElementById("dsStaffMonth").value = month;

  // refresh list
  renderStaffDataSubmission();
}

async function applyARMVisibilityForStaff() {
  const armBtn = document.getElementById("staffARMBtn");
  if (!armBtn) return;

  const { data, error } = await supabase
    .from("arm_assignments")
    .select("area_manager")
    .eq("staff", currentUsername)
    .limit(1);

  if (error) {
    console.error("Failed to check ARM visibility:", error);
    armBtn.style.display = "none";
    return;
  }

  // show button only if at least one assignment exists
  armBtn.style.display = data && data.length > 0 ? "block" : "none";
}

function setSUFPReadOnly(readonly) {
  document.getElementById("sufpStatus").disabled = readonly;
  document.getElementById("sufpMalNumber").readOnly = readonly;
  document.getElementById("sufpVerifiedAmount").readOnly = readonly;
  document.getElementById("sufpComments").readOnly = readonly;

  document.getElementById("sufpEditBtn")
    .classList.toggle("d-none", !readonly);

  document.getElementById("sufpSaveBtn")
    .classList.toggle("d-none", readonly);
}

function enableSUFPEdit() {
  setSUFPReadOnly(false);
}
function getWeekOfMonth(date) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  return Math.ceil((date.getDate() + firstDay.getDay()) / 7);
}
function formatMonthLabel(month) {
  if (!month) return "";

  const [year, m] = month.split("-");
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  const monthIndex = parseInt(m, 10) - 1;
  const shortYear = year.slice(-2);

  return `${monthNames[monthIndex]}-${shortYear}`;
}

/**************************************************
 * SERVICE USER PREFIX & BULK UPLOAD
 **************************************************/

/* AUTO PREFIX SUID */
function normalizeSUID() {
  let v = document.getElementById("suIdInput").value.trim().toUpperCase();
  if (!v) return;
  if (!v.startsWith("SU")) v = "SU" + v.replace(/^0+/, "");
  document.getElementById("suIdInput").value = v;
}

/* AUTO PREFIX PR ID */
function normalizePRID() {
  let v = suPropertyIdInput.value.trim().toUpperCase();
  if (!v) return;
  if (!v.startsWith("PR")) v = "PR" + v.replace(/^0+/, "");
  suPropertyIdInput.value = v;
}

/* DOWNLOAD EXCEL TEMPLATE */
async function downloadServiceUserTemplate() {

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Service Users Template");

  // ===== HEADER ROW =====
  const headers = [
    "SUID",
    "Full Name",
    "PR ID",
    "Line Manager",
    "Area Manager",
    "Effective From Month (YYYY-MM)",
    "Total Budget (£)",
    "Daily Allowance (£)",
    "Weekly Allowance (£)",
    "Budget Valid From (YYYY-MM-DD)",
    "Budget Valid Through (YYYY-MM-DD)"
  ];

  worksheet.addRow(headers);

  // ===== STYLE HEADER =====
  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F4E78" } // professional dark blue
    };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
  });

  // ===== SAMPLE ROW =====
  worksheet.addRow([
    "SU0001",
    "John Smith",
    "PR0079",
    "Katie Potter",
    "Area Manager Name",
    "2026-01",
    5000,
    50,
    300,
    "2026-01-01",
    "2026-12-31"
  ]);

  // ===== FORMAT CURRENCY COLUMNS =====
  worksheet.getColumn(7).numFmt = "£#,##0.00";
  worksheet.getColumn(8).numFmt = "£#,##0.00";
  worksheet.getColumn(9).numFmt = "£#,##0.00";

  // ===== COLUMN WIDTHS =====
  worksheet.columns = [
    { width: 12 },
    { width: 22 },
    { width: 12 },
    { width: 20 },
    { width: 20 },
    { width: 20 },
    { width: 18 },
    { width: 18 },
    { width: 20 },
    { width: 20 },
    { width: 22 }
  ];

  // ===== FREEZE HEADER =====
  worksheet.views = [
    { state: "frozen", ySplit: 1 }
  ];

  // ===== GENERATE FILE =====
  const buffer = await workbook.xlsx.writeBuffer();

  saveAs(
    new Blob([buffer]),
    "Service_Users_Bulk_Upload_Template.xlsx"
  );
}
/* BULK UPLOAD (CSV) */
/* BULK UPLOAD (CSV) */
async function bulkUploadServiceUsers() {
  const fileInput = document.getElementById("bulkServiceUserFile");
  const file = fileInput?.files?.[0];

  if (!file) {
    alert("Please select a CSV file first");
    return;
  }

  const reader = new FileReader();

  reader.onload = async function (e) {
    const text = e.target.result
      .replace(/\uFEFF/g, "")
      .replace(/\r/g, "");

    const lines = text
      .split("\n")
      .slice(1)
      .filter(l => l.trim());

    const { data: existing, error } = await supabase
      .from("service_users")
      .select("suid");

    if (error) {
      console.error(error);
      alert("Failed to load existing service users");
      return;
    }

    const existingIds = new Set(
      (existing || []).map(su =>
        su.suid
          ?.replace(/\uFEFF/g, "")
          .replace(/\s+/g, "")
          .toUpperCase()
      )
    );

    const rowsToInsert = [];
    const budgetRows = [];

   lines.forEach(line => {

  const [
    suid,
    fullName,
    prid,
    lm,
    am,
    effectiveMonth,
    totalBudget,
    dailyAllowance,
    weeklyAllowance,
    validFrom,
    validThrough
  ] = line.split(",").map(v => v?.trim());

  if (!suid || !fullName) return;

  const normSU = suid
    .replace(/\uFEFF/g, "")
    .replace(/\s+/g, "")
    .toUpperCase();

  if (existingIds.has(normSU)) return;

  rowsToInsert.push({
    suid: normSU,
    fullName,
    propertyid: prid?.toUpperCase() || "",
    linemanager: lm || "",
    areamanager: am || "",
    effectivefrommonth: effectiveMonth || null,
    active: true,
    created_at: new Date().toISOString()
  });

  // 🔥 STORE BUDGET SEPARATELY
  if (totalBudget && validFrom && validThrough) {

    budgetRows.push({
      suid: normSU,
      total_budget: Number(totalBudget),
      daily_allowance: dailyAllowance ? Number(dailyAllowance) : null,
      weekly_allowance: weeklyAllowance ? Number(weeklyAllowance) : null,
      valid_from: validFrom,
      valid_through: validThrough
    });

  }

});

    if (!rowsToInsert.length) {
      alert("No new service users to upload");
      return;
    }

    const { error: insertError } = await supabase
      .from("service_users")
      .insert(rowsToInsert);
    if (budgetRows.length) {

  const { error: budgetError } = await supabase
    .from("service_user_budgets")
    .insert(budgetRows);

  if (budgetError) {
    console.error(budgetError);
    alert("Service users added but budget insert failed");
    return;
  }
}

    if (insertError) {
      console.error(insertError);
      alert("Bulk upload failed");
      return;
    }

    alert(`Bulk upload completed (${rowsToInsert.length} users added)`);
    fileInput.value = ""; // reset input
  };

  reader.readAsText(file);
}


/* =========================
   REPORTS SUBMENU
========================= */
function toggleReportsSubMenu() {
  const submenu = document.getElementById("reportsSubMenu");
  submenu.style.display =
    submenu.style.display === "block" ? "none" : "block";
}

/* =========================
   OPEN SERVICE USERS REPORT
========================= */
async function openServiceUsersReport() {
  if (!hasPermission("reports")) {
    alert("Access denied");
    return;
  }

  closeAllMenus();
  hideAllPanels();

  const tbody = document.getElementById("serviceUsersReportBody");
  tbody.innerHTML = "";

  /* =========================
     🔹 LOAD SERVICE USERS (ONCE)
  ========================= */
 const { data, error } = await supabase
  .from("service_users")
  .select(`
    suid,
    fullName,
    propertyid,
    linemanager,
    areamanager,
    active,
    effectivefrommonth,
    service_user_budgets (
      total_budget,
      daily_allowance,
      weekly_allowance,
      valid_from,
      valid_through
    )
  `)
  .order("suid", { ascending: true });

  if (error) {
    console.error(error);
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center text-danger">
          Failed to load service users
        </td>
      </tr>
    `;
    document.getElementById("serviceUsersReport").style.display = "block";
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center">
          No service users found
        </td>
      </tr>
    `;
    document.getElementById("serviceUsersReport").style.display = "block";
    return;
  }

  /* ✅ CACHE DATA (SINGLE SOURCE OF TRUTH) */
  serviceUsersCache = data;

  /* ✅ RENDER USING FILTER LOGIC */
  renderServiceUsersReport();

  document.getElementById("serviceUsersReport").style.display = "block";
}


function openAssignedSUFPReport() {
  closeAllMenus();

  // 🔒 FORCE admin sidebar to close
  document.getElementById("rightSidebar").classList.remove("open");

  hideAllPanels();

  document.getElementById("assignedSUFPMonth").value = "";
  document.getElementById("assignedSUFPStaffFilter").value = "";

  document.getElementById("assignedSUFPBody").innerHTML = `
    <tr>
      <td colspan="8" class="text-center text-muted">
        Select a month to view assigned SUFP
      </td>
    </tr>
  `;

  document.getElementById("assignedSUFPReport").style.display = "block";
}
/**************************************************
 * ADMIN DASHBOARD KPIs + PIE CHART (FIXED)
 **************************************************/
function getWeekOfMonthSimple(date) {
  return Math.ceil(date.getDate() / 7);
}

function handleAdminStaffTimeRangeUI() {
  const range =
    document.getElementById("adminStaffTimeRange")?.value;

  const weekSel =
    document.getElementById("adminStaffWeek");
  const dateSel =
    document.getElementById("adminStaffDate");

  if (!weekSel || !dateSel) return;

  weekSel.classList.add("d-none");
  dateSel.classList.add("d-none");

  if (range === "WEEKLY") {
    weekSel.classList.remove("d-none");
  }

  if (range === "DAILY") {
    dateSel.classList.remove("d-none");

    if (!dateSel.value) {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      dateSel.value = d.toISOString().slice(0, 10);
    }
  }
}


async function renderAdminKPIs(month, taskType, staffFilter) {
  /* =========================
     LOAD DATA FROM SUPABASE
  ========================= */
  const [
    { data: assignments },
    { data: details }
  ] = await Promise.all([
    supabase
      .from("sufp_assignments")
      .select("*")
      .eq("month", month),

    supabase
      .from("sufp_task_details")
      .select("*")
      .eq("month", month)
  ]);

  const filtered = (assignments || []).filter(a => {
    if (a.month !== month) return false;
    if (taskType !== "ALL" && a.type !== taskType) return false;
    if (staffFilter !== "ALL" && a.staff !== staffFilter) return false;
    return true;
  });

  const total = filtered.length;
  let completed = 0;
  let inProgress = 0;
  let pending = 0;

  filtered.forEach(a => {
    const d = (details || []).find(
      x =>
        x.suid === a.suid &&
        x.month === a.month &&
        x.type === a.type
    );

    if (!d) {
      pending++;
    } else if (d.status === "COMPLETED") {
      completed++;
    } else if (d.status === "IN_PROGRESS") {
      inProgress++;
    } else {
      pending++;
    }
  });

  const percent =
    total === 0
      ? 0
      : Math.round((completed / total) * 10000) / 100;

  /* =========================
     KPI OUTPUT
  ========================= */
  document.getElementById("kpiTotal").innerText = total;
  document.getElementById("kpiCompleted").innerText = completed;
  document.getElementById("kpiPending").innerText = pending;
  document.getElementById("kpiPercent").innerText =
    total === 0
      ? "0%"
      : Math.round((completed / total) * 100) + "%";

  renderAdminPieChartFromKPIs(
    completed,
    inProgress,
    pending
  );
}
async function renderOverspendingReport() {

  const month = document.getElementById("overspendMonth").value;
  if (!month) return;

  const body = document.getElementById("overspendingBody");
  body.innerHTML = "";

  // Get service users
  const { data: users } = await supabase
    .from("service_users")
    .select("*")
    .eq("active", true);

  let index = 1;

  for (const user of users) {

    // Get active budget for month
    const { data: budget } = await supabase
      .from("service_user_budgets")
      .select("*")
      .eq("suid", user.suid)
      .lte("valid_from", month + "-31")
      .gte("valid_through", month + "-01")
      .single();

    if (!budget) continue;

    // Get verified total for month
    const { data: tasks } = await supabase
      .from("sufp_task_details")
      .select("verified_amount")
      .eq("suid", user.suid)
      .eq("month", month);

    const totalVerified = tasks?.reduce(
      (sum, t) => sum + (Number(t.verified_amount) || 0),
      0
    ) || 0;

    const difference = budget.total_budget - totalVerified;
    const status = difference < 0 ? "OVERSPENT" : "Within Budget";

    const row = `
      <tr class="${difference < 0 ? 'table-danger' : ''}">
        <td class="text-center">${index++}</td>
        <td>${user.suid}</td>
        <td>${user.fullName}</td>
        <td>£${budget.total_budget.toFixed(2)}</td>
        <td>£${totalVerified.toFixed(2)}</td>
        <td>£${difference.toFixed(2)}</td>
        <td>${status}</td>
      </tr>
    `;

    body.innerHTML += row;
  }
}
/* =========================
   RENDER REPORT (FILTERED)
========================= */
function renderServiceUsersReport() {
  const tbody = document.getElementById("serviceUsersReportBody");
  tbody.innerHTML = "";

  const search =
    document.getElementById("filterSearch").value.toLowerCase();
  const prFilter =
    document.getElementById("filterPR").value.toUpperCase();
  const statusFilter =
    document.getElementById("filterStatus").value;

  /* ✅ FILTER FROM CACHE ONLY */
  const filtered = serviceUsersCache.filter(su => {
    const matchesSearch =
      (su.fullName || "").toLowerCase().includes(search) ||
      su.suid.toLowerCase().includes(search);

    const matchesPR =
      !prFilter ||
      (su.propertyid || "").toUpperCase().includes(prFilter);

    const matchesStatus =
      !statusFilter ||
      (statusFilter === "active" && su.active) ||
      (statusFilter === "inactive" && !su.active);

    return matchesSearch && matchesPR && matchesStatus;
  });

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center">
          No matching service users
        </td>
      </tr>
    `;
    return;
  }

  /* ✅ RENDER (NO ASYNC, NO DB) */
  filtered.forEach((su, index) => {
    const row = document.createElement("tr");

    const budget = su.service_user_budgets?.[0] || {};

row.innerHTML = `
  <td>
    <input type="checkbox"
           class="su-select"
           value="${su.suid}">
  </td>

  <td>${index + 1}</td>
  <td>${su.suid}</td>
  <td>${su.fullName || ""}</td>
  <td>${su.propertyid || ""}</td>
  <td>${su.linemanager || ""}</td>
  <td>${su.areamanager || ""}</td>

<td class="text-center">
  ${budget.total_budget != null 
    ? "£" + Number(budget.total_budget).toLocaleString("en-GB", { minimumFractionDigits: 2 }) 
    : "-"}
</td>

<td class="text-center">
  ${budget.daily_allowance != null 
    ? "£" + Number(budget.daily_allowance).toLocaleString("en-GB", { minimumFractionDigits: 2 }) 
    : "-"}
</td>

<td class="text-center">
  ${budget.weekly_allowance != null 
    ? "£" + Number(budget.weekly_allowance).toLocaleString("en-GB", { minimumFractionDigits: 2 }) 
    : "-"}
</td>
  <td>${budget.valid_from ?? "-"}</td>
  <td>${budget.valid_through ?? "-"}</td>
  <td>${su.effectivefrommonth || "-"}</td>

  <td>
    <span class="badge ${
      su.active ? "bg-success" : "bg-secondary"
    }">
      ${su.active ? "Active" : "Inactive"}
    </span>
  </td>
`;

    tbody.appendChild(row);
  });
}


async function syncARMIssues() {
  /* =========================
     LOAD ALL REQUIRED DATA
  ========================= */
  const [
    { data: armAssignments },
    { data: armIssues },
    { data: sufpDetails },
    { data: dataSubs },
    { data: serviceUsers }
  ] = await Promise.all([
    supabase.from("arm_assignments").select("*"),
    supabase.from("arm_issues").select("*"),
    supabase.from("sufp_task_details").select("*"),
    supabase.from("data_submissions").select("*"),
    supabase.from("service_users").select("*")
  ]);

  const newIssues = [];
  const updates = [];

  /* =========================
     🔹 HANDLE SUFP COMMENTS
  ========================= */
  (sufpDetails || []).forEach(d => {
    if (!d.comments || !d.comments.trim()) return;

    const su = (serviceUsers || []).find(s => s.suid === d.suid);
    if (!su) return;

    const am = su.areamanager;
    const assigned = (armAssignments || []).find(a => a.area_manager === am);
    if (!assigned) return;

    const existing = (armIssues || []).find(i =>
      i.source === "SUFP" &&
      i.suid === d.suid &&
      i.month === d.month
    );

    if (!existing) {
      newIssues.push({
        area_manager: am,
        line_manager: su.linemanager,
        prid: su.propertyid,
        suid: d.suid,
        source: "SUFP",
        source_comment: d.comments.trim(),
        month: d.month,
        status: "PENDING",
        arm_comment: "",
        assigned_to: assigned.staff,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    } else {
      updates.push({
        id: existing.id,
        source_comment: d.comments.trim(),
        status: existing.status === "RESOLVED" ? "PENDING" : existing.status,
        updated_at: new Date().toISOString()
      });
    }
  });

  /* =========================
     🔹 HANDLE DATA SUBMISSION
  ========================= */
  (dataSubs || []).forEach(d => {
    if (!d.comments || !d.comments.trim()) return;

    const suFallback = (serviceUsers || []).find(
      s => s.propertyid === d.prid && s.active
    );
    if (!suFallback) return;

    const am = suFallback.areamanager;
    const assigned = (armAssignments || []).find(a => a.area_manager === am);
    if (!assigned) return;

    const existing = (armIssues || []).find(i =>
      i.source === "DATA" &&
      i.prid === d.prid &&
      i.month === d.month
    );

    if (!existing) {
      newIssues.push({
        area_manager: am,
        line_manager: suFallback.linemanager,
        prid: d.prid,
        suid: null,
        source: "DATA",
        source_comment: d.comments.trim(),
        month: d.month,
        status: "PENDING",
        arm_comment: "",
        assigned_to: assigned.staff,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    } else {
      updates.push({
        id: existing.id,
        source_comment: d.comments.trim(),
        status: existing.status === "RESOLVED" ? "PENDING" : existing.status,
        updated_at: new Date().toISOString()
      });
    }
  });

  /* =========================
     🔹 AUTO-RESOLVE
  ========================= */
  (armIssues || []).forEach(issue => {
    if (issue.source === "SUFP") {
      const stillExists = (sufpDetails || []).some(d =>
        d.suid === issue.suid &&
        d.month === issue.month &&
        d.comments &&
        d.comments.trim()
      );
      if (!stillExists && issue.status !== "RESOLVED") {
        updates.push({
          id: issue.id,
          status: "RESOLVED",
          updated_at: new Date().toISOString()
        });
      }
    }

    if (issue.source === "DATA") {
      const stillExists = (dataSubs || []).some(d =>
        d.prid === issue.prid &&
        d.month === issue.month &&
        d.comments &&
        d.comments.trim()
      );
      if (!stillExists && issue.status !== "RESOLVED") {
        updates.push({
          id: issue.id,
          status: "RESOLVED",
          updated_at: new Date().toISOString()
        });
      }
    }
  });

  /* =========================
     WRITE TO SUPABASE
  ========================= */
  if (newIssues.length) {
    await supabase.from("arm_issues").insert(newIssues);
  }

  for (const u of updates) {
    await supabase
      .from("arm_issues")
      .update(u)
      .eq("id", u.id);
  }
}


/* =========================
   EXPORT CSV
========================= */
async function exportServiceUsersCSV() {
  /* =========================
     LOAD SERVICE USERS
  ========================= */
  const { data: serviceUsers, error } = await supabase
    .from("service_users")
    .select(
      "suid, fullName, propertyid, linemanager, areamanager, active"
    );

  if (error) {
    console.error(error);
    alert("Failed to load service users");
    return;
  }

  let csv = "SUID,Full Name,PR ID,Line Manager,Area Manager,Status\n";

  (serviceUsers || []).forEach(su => {
    csv += `${su.suid},"${su.fullName || ""}",${su.propertyid || ""},"${su.linemanager || ""}","${su.areamanager || ""}",${su.active ? "Active" : "Inactive"}\n`;
  });

  /* =========================
     DOWNLOAD CSV
  ========================= */
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "service_users_report.csv";
  a.click();

  URL.revokeObjectURL(url);
}
async function exportServiceUsersExcel() {

  if (!serviceUsersCache || serviceUsersCache.length === 0) {
    alert("No data to export.");
    return;
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Service Users");

// =========================
// PROFESSIONAL HEADER (MATCH DATA SUBMISSION)
// =========================

const totalColumns = 13; // number of columns in this report

// Main Title
worksheet.mergeCells(1, 1, 1, totalColumns);
const titleCell = worksheet.getCell(1, 1);
titleCell.value = "FLOATS TASK SYSTEM";
titleCell.font = { size: 18, bold: true };
titleCell.alignment = { horizontal: "center", vertical: "middle" };

// Report Name
worksheet.mergeCells(2, 1, 2, totalColumns);
const reportCell = worksheet.getCell(2, 1);
reportCell.value = "Service Users Report";
reportCell.font = { size: 14, bold: true };
reportCell.alignment = { horizontal: "center", vertical: "middle" };

// Export Date
worksheet.mergeCells(3, 1, 3, totalColumns);
const dateCell = worksheet.getCell(3, 1);
dateCell.value = "Exported On: " + new Date().toLocaleString();
dateCell.alignment = { horizontal: "center", vertical: "middle" };

// Add spacing row
worksheet.addRow([]);

  // =========================
  // COLUMN HEADERS
  // =========================
  const headerRow = worksheet.addRow([
    "Sr. No",
    "SUID",
    "Full Name",
    "PR ID",
    "Line Manager",
    "Area Manager",
    "Total Budget (£)",
    "Daily Allowance (£)",
    "Weekly Allowance (£)",
    "Budget Valid From",
    "Budget Valid Through",
    "Effective Month",
    "Status"
  ]);

  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: "center" };

  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F2937" }
    };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  // =========================
  // DATA ROWS
  // =========================
  serviceUsersCache.forEach((su, index) => {

    const budget = su.service_user_budgets?.[0] || {};

    const row = worksheet.addRow([
      index + 1,
      su.suid || "",
      su.fullName || "",
      su.propertyid || "",
      su.linemanager || "",
      su.areamanager || "",
      budget.total_budget ?? "",
      budget.daily_allowance ?? "",
      budget.weekly_allowance ?? "",
      budget.valid_from ?? "",
      budget.valid_through ?? "",
      su.effectivefrommonth || "",
      su.active ? "Active" : "Inactive"
    ]);

    // Center numeric columns
    row.getCell(1).alignment = { horizontal: "center" }; // Sr No
    row.getCell(7).alignment = { horizontal: "center" }; // Total
    row.getCell(8).alignment = { horizontal: "center" }; // Daily
    row.getCell(9).alignment = { horizontal: "center" }; // Weekly
    // Currency formatting
row.getCell(7).numFmt = '£#,##0.00';
row.getCell(8).numFmt = '£#,##0.00';
row.getCell(9).numFmt = '£#,##0.00';
  });

  // =========================
  // COLUMN WIDTHS
  // =========================
  worksheet.columns = [
    { width: 10 },
    { width: 15 },
    { width: 22 },
    { width: 15 },
    { width: 20 },
    { width: 20 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 14 }
  ];

  // =========================
  // BORDER STYLING
  // =========================
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
    });
  });

  // =========================
  // SAVE FILE
  // =========================
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer]),
    "Service_Users_Report.xlsx"
  );
}

/* =========================
   CLOSE REPORT
========================= */
function closeServiceUsersReport() {
  restoreDashboard();
}

/* =========================
   OPEN PERMISSIONS FORM
========================= */
async function openPermissionsForm() {
  if (currentUserRole !== "Admin") return;

  closeAllMenus();
  hideAllPanels();

  const select = document.getElementById("permissionUserSelect");
  select.innerHTML = "";

  // 🔹 Load users from Supabase
  const { data: users, error } = await supabase
    .from("users")
    .select("name, username, role")
    .neq("role", "Admin");

  if (error) {
    console.error(error);
    alert("Failed to load users");
    return;
  }

  users.forEach(u => {
    const opt = document.createElement("option");
    opt.value = u.username;
    opt.textContent = `${u.name} (${u.username})`;
    select.appendChild(opt);
  });

  if (select.options.length) {
    select.selectedIndex = 0;
    loadUserPermissions();
  }

  document.getElementById("userPermissionsForm").style.display = "block";
}


/* =========================
   LOAD USER PERMISSIONS
========================= */
async function loadUserPermissions() {
  const username = permissionUserSelect.value;
  if (!username) return;

  const { data: user, error } = await supabase
    .from("users")
    .select("permissions")
    .eq("username", username)
    .single();

  if (error) {
    console.error(error);
    alert("Failed to load user permissions");
    return;
  }

  const perms = user?.permissions || {};

  permReports.checked = !!perms.reports;
  permAddSU.checked = !!perms.addServiceUser;
  permUpdateManagers.checked = !!perms.updateManagers;
}


/* =========================
   SAVE USER PERMISSIONS
========================= */
async function saveUserPermissions() {
  const username = permissionUserSelect.value;
  if (!username) return;

  const permissions = {
    reports: permReports.checked,
    addServiceUser: permAddSU.checked,
    updateManagers: permUpdateManagers.checked
  };

  const { error } = await supabase
    .from("users")
    .update({ permissions })
    .eq("username", username);

  if (error) {
    console.error(error);
    alert("Failed to update permissions");
    return;
  }

  alert("Permissions updated successfully");
  restoreDashboard();
}


/* =========================
   CLOSE PERMISSIONS FORM
========================= */
function closePermissionsForm() {
  document.getElementById("userPermissionsForm").style.display = "none";
}
function applyStaffPermissions(user) {
  const perms = user.permissions || {};

  // Reports
  document.getElementById("staffReportsBtn").style.display =
    perms.reports ? "block" : "none";

  // Add Service User
  document.getElementById("staffAddSUBtn").style.display =
    perms.addServiceUser ? "block" : "none";

  // Update LM & AM
  document.getElementById("staffUpdateManagersBtn").style.display =
    perms.updateManagers ? "block" : "none";
}
async function loadPrIdsForManagerUpdate() {
  const select = document.getElementById("updatePrId");
  select.innerHTML = "";

  // 🔹 Load service users from Supabase
  const { data, error } = await supabase
    .from("service_users")
    .select("propertyid")
    .not("propertyid", "is", null);

  if (error) {
    console.error(error);
    alert("Failed to load PR IDs");
    return;
  }

  // 🔁 Same dedupe logic as before
  const prids = [
    ...new Set(data.map(su => su.propertyid).filter(Boolean))
  ];

  prids.forEach(pr => {
    const opt = document.createElement("option");
    opt.value = pr;
    opt.textContent = pr;
    select.appendChild(opt);
  });

  // 🔑 auto-load managers when PR changes
  select.onchange = function () {
    loadCurrentManagersForPR(this.value);
  };

  // 🔑 auto-load first PR managers
  if (prids.length) {
    select.value = prids[0];
    loadCurrentManagersForPR(prids[0]);
  }
}

function openAddManagersForm() {
  if (!hasPermission("updateManagers")) {
    alert("Access denied");
    return;
  }

  closeAllMenus();
  hideAllPanels();
  loadPrIdsForManagerUpdate();
  document.getElementById("addManagersForm").style.display = "block";
}
async function saveManagerUpdate() {
  const prid = document.getElementById("updatePrId").value;
  const lm = document.getElementById("updateLineManager").value.trim();
  const am = document.getElementById("updateAreaManager").value.trim();
  const date = document.getElementById("updateEffectiveDate").value;

  if (!prid || !lm || !am || !date) {
    alert("All fields are required");
    return;
  }

  /* =========================
     1️⃣ INSERT MANAGER HISTORY
  ========================= */
  const { error: historyError } = await supabase
    .from("manager_history")
    .insert([{
      prid,
      linemanager: lm,
      areamanager: am,
      effectivefrom: date
    }]);

  if (historyError) {
    console.error(historyError);
    alert("Failed to save manager history");
    return;
  }

  /* =========================
     2️⃣ SYNC ACTIVE SERVICE USERS
  ========================= */
  const { error: suError } = await supabase
    .from("service_users")
    .update({
      linemanager: lm,
      areamanager: am
    })
    .eq("propertyid", prid)
    .eq("active", true);

  if (suError) {
    console.error(suError);
    alert("Failed to sync service users");
    return;
  }

alert("Managers updated successfully");
restoreDashboard();
}

async function getManagersForPRByMonth(prid, month) {
  if (!prid || !month) return null;

  const monthDate = month + "-01";

  const { data, error } = await supabase
    .from("manager_history")
    .select("prid, linemanager, areamanager, effectivefrom")
    .eq("prid", prid)
    .lte("effectivefrom", monthDate)
    .order("effectivefrom", { ascending: false })
    .limit(1);

  if (error) {
    console.error(error);
    return null;
  }

  return data.length ? data[0] : null;
}

async function loadCurrentManagersForPR(prid) {
  const lmInput = document.getElementById("updateLineManager");
  const amInput = document.getElementById("updateAreaManager");

  if (!prid) {
    lmInput.value = "";
    amInput.value = "";
    return;
  }

  // latest manager (ignores date — correct for update screen)
  const mgr = await getManagersForPR(prid);

  if (mgr) {
    lmInput.value = mgr.linemanager || "";
    amInput.value = mgr.areamanager || "";
  } else {
    lmInput.value = "";
    amInput.value = "";
  }
}


async function getManagersForPR(prid) {
  if (!prid) return null;

  const { data, error } = await supabase
    .from("manager_history")
    .select("prid, linemanager, areamanager, effectivefrom")
    .eq("prid", prid)
    .order("effectivefrom", { ascending: false })
    .limit(1);

  if (error) {
    console.error(error);
    return null;
  }

  return data.length ? data[0] : null;
}


async function openAssignSUFPForm() {
  closeAllMenus();
  hideAllPanels();

  // reset month
  const monthInput = document.getElementById("sufpMonth");
monthInput.onchange = async function () {
  const month = monthInput.value;
  const statusBox = document.getElementById("assignmentStatus");

  statusBox.style.display = "none";
  statusBox.innerHTML = "";

  if (!month) return;

  const stats = await getAssignmentStatsForMonth(month);

  statusBox.style.display = "block";

  if (stats.total === 0) {
    statusBox.innerHTML = `
      <strong>No active service users</strong><br>
      There are no active service users eligible for this month.
    `;
    return;
  }

  if (stats.newUsers === 0) {
    statusBox.innerHTML = `
      <strong class="text-success">✔ Assignments Complete</strong><br>
      • Total Active Service Users: <b>${stats.total}</b><br>
      • Already Assigned: <b>${stats.alreadyAssigned}</b><br><br>
      <span class="text-muted">
        All service users are already assigned for this month.
      </span>
    `;
    return;
  }

  statusBox.innerHTML = `
    <strong class="text-warning">⚠ Assignment Summary</strong><br>
    • Total Active Service Users: <b>${stats.total}</b><br>
    • Already Assigned: <b>${stats.alreadyAssigned}</b><br>
    • New Service Users Pending: <b>${stats.newUsers}</b><br><br>
    <span class="text-success">
      Clicking <b>Assign SUFP</b> will assign tasks
      <u>only</u> to the <b>${stats.newUsers}</b> new service users.
    </span>
  `;
};

  if (monthInput) monthInput.value = "";

  const tbody = document.getElementById("sufpTeamCapacityBody");
  tbody.innerHTML = "";

  /* =========================
     🔹 LOAD STAFF FROM SUPABASE
  ========================= */
  const { data: users, error } = await supabase
    .from("users")
    .select("username, name, role")
    .eq("role", "Staff");

  if (error) {
    console.error(error);
    tbody.innerHTML = `
      <tr>
        <td colspan="3" class="text-center text-danger">
          Failed to load staff members
        </td>
      </tr>
    `;
    return;
  }

  if (!users.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" class="text-center text-muted">
          No staff members found
        </td>
      </tr>
    `;
  } else {
    users.forEach(user => {
      const tr = document.createElement("tr");

      // ⚠️ CRITICAL — DO NOT REMOVE
      tr.dataset.username = user.username;

      tr.innerHTML = `
        <td>${user.name}</td>
        <td>
          <input type="number"
                 class="form-control sufp-capacity"
                 min="0"
                 placeholder="Auto">
        </td>
        <td>
          <input type="number"
                 class="form-control review-capacity"
                 min="0"
                 placeholder="Auto">
        </td>
      `;

      tbody.appendChild(tr);
    });
  }

  document.getElementById("assignSUFPForm").style.display = "block";
}

async function openAssignARMForm() {
  closeAllMenus();
  hideAllPanels();

  const tbody = document.getElementById("armAssignmentBody");
  tbody.innerHTML = "";

  /* =========================
     🔹 LOAD ACTIVE AREA MANAGERS
  ========================= */
  const { data: serviceUsers, error: suError } = await supabase
    .from("service_users")
    .select("areamanager, active")
    .eq("active", true)
    .not("areamanager", "is", null);

  if (suError) {
    console.error(suError);
    tbody.innerHTML = `
      <tr>
        <td colspan="2" class="text-danger text-center">
          Failed to load Area Managers
        </td>
      </tr>
    `;
    return;
  }

  // UNIQUE AREA MANAGERS (same logic as before)
  const areamanagers = [
    ...new Set(serviceUsers.map(su => su.areamanager))
  ];

  /* =========================
     🔹 LOAD STAFF USERS
  ========================= */
  const { data: staffUsers, error: userError } = await supabase
    .from("users")
    .select("username, name")
    .eq("role", "Staff");

  if (userError) {
    console.error(userError);
    tbody.innerHTML = `
      <tr>
        <td colspan="2" class="text-danger text-center">
          Failed to load staff users
        </td>
      </tr>
    `;
    return;
  }

  /* =========================
     🔹 LOAD SAVED ARM ASSIGNMENTS
  ========================= */
  const { data: savedRows, error: mapError } = await supabase
    .from("arm_assignments")
.select("area_manager, staff");

  if (mapError) {
    console.error(mapError);
  }

  // convert rows → object (same shape as before)
  const saved = {};
  (savedRows || []).forEach(r => {
    saved[r.area_manager] = r.staff;
  });

  if (!areamanagers.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="2" class="text-center text-muted">
          No Area Managers found
        </td>
      </tr>
    `;
  }

  /* =========================
     🔹 RENDER TABLE (UNCHANGED UI)
  ========================= */
  areamanagers.forEach(am => {
    const tr = document.createElement("tr");

    const options = staffUsers
      .map(
        u =>
          `<option value="${u.username}"
            ${saved[am] === u.username ? "selected" : ""}>
            ${u.name}
          </option>`
      )
      .join("");

    tr.innerHTML = `
      <td>${am}</td>
      <td>
        <select class="form-select arm-staff-select"
                data-am="${am}">
          <option value="">-- Select Team Member --</option>
          ${options}
        </select>
      </td>
    `;

    tbody.appendChild(tr);
  });

  document.getElementById("assignARMForm").style.display = "block";
}

async function saveARMAssignments() {
  const selects =
    document.querySelectorAll(".arm-staff-select");

  const rows = [];

  selects.forEach(sel => {
    const areamanager = sel.dataset.am;
    const staffUsername = sel.value;

    if (staffUsername) {
      rows.push({
  area_manager: areamanager,
  staff: staffUsername
});

    }
  });

  /* =========================
     🔹 RESET + SAVE (ATOMIC)
  ========================= */

  // 1️⃣ Clear existing mappings
  const { error: deleteError } = await supabase
    .from("arm_assignments")
   .delete()
.neq("area_manager", "");


  if (deleteError) {
    console.error(deleteError);
    alert("Failed to reset ARM assignments");
    return;
  }

  // 2️⃣ Insert new mappings
  if (rows.length) {
    const { error: insertError } = await supabase
      .from("arm_assignments")
      .insert(rows);

    if (insertError) {
      console.error(insertError);
      alert("Failed to save ARM assignments");
      return;
    }
  }

alert("ARM assignments saved successfully");
restoreDashboard();
}

/**************************************************
 * SUFP ASSIGNMENT LOGIC
 **************************************************/

async function assignSUFPTasks() {
  const month = document.getElementById("sufpMonth").value;
  if (!month) {
    alert("Please select assignment month");
    return;
  }

  // 🚫 BLOCK current & future months
  const currentMonth = new Date().toISOString().slice(0, 7);
  if (month >= currentMonth) {
    alert(
      "You cannot assign SUFP tasks for the current or future months.\n\n" +
      "Only past months are allowed."
    );
    return;
  }

  /* =========================
     🔹 LOAD SERVICE USERS
  ========================= */
  const { data: serviceUsers, error: suError } = await supabase
    .from("service_users")
    .select("suid, active, effectivefrommonth");

  if (suError) {
    console.error(suError);
    alert("Failed to load service users");
    return;
  }

  /* =========================
     🔹 LOAD EXISTING ASSIGNMENTS (MONTH)
  ========================= */
const { data: existingAssignments, error: asgError } = await supabase
  .from("sufp_assignments")
  .select("suid")
  .eq("month", month);


  if (asgError) {
    console.error(asgError);
    alert("Failed to load existing assignments");
    return;
  }

  const assignedSUIds = new Set(
  (existingAssignments || []).map(a => a.suid)
);


  /* =========================
     🔹 FILTER ACTIVE + NEW SERVICE USERS
  ========================= */
  const activeServiceUsers = serviceUsers.filter(
    su =>
      su.active &&
      !assignedSUIds.has(su.suid) &&
      (!su.effectivefrommonth || su.effectivefrommonth <= month)
  );

  if (activeServiceUsers.length === 0) {
    alert("No new service users to assign for this month.");
    return;
  }

  /* =========================
     🔹 BUILD STAFF POOL FROM UI
  ========================= */
  const rows = document.querySelectorAll("#sufpTeamCapacityBody tr");

  const staffPool = [];

  rows.forEach(row => {
    staffPool.push({
      username: row.dataset.username,
      sufpCap: row.querySelector(".sufp-capacity").value
        ? parseInt(row.querySelector(".sufp-capacity").value)
        : null,
      reviewCap: row.querySelector(".review-capacity").value
        ? parseInt(row.querySelector(".review-capacity").value)
        : null,
      sufpAssigned: 0,
      reviewAssigned: 0
    });
  });

  if (staffPool.length < 2) {
    alert("At least 2 staff members are required for Review separation");
    return;
  }

  /* =========================
     1️⃣ ASSIGN SUFP (ROUND ROBIN)
  ========================= */
  let sufpIndex = 0;
  const sufpOwnerMap = {};
  const newAssignments = [];

  activeServiceUsers.forEach(su => {
    let attempts = 0;

    while (attempts < staffPool.length) {
      const staff = staffPool[sufpIndex];

      if (staff.sufpCap === null || staff.sufpAssigned < staff.sufpCap) {
      newAssignments.push({
  month,
  type: "SUFP",
  staff: staff.username,
  suid: su.suid
});


        staff.sufpAssigned++;
        sufpOwnerMap[su.suid] = staff.username;
        sufpIndex = (sufpIndex + 1) % staffPool.length;
        return;
      }

      sufpIndex = (sufpIndex + 1) % staffPool.length;
      attempts++;
    }
  });

  /* =========================
     2️⃣ ASSIGN REVIEW (NOT SAME STAFF)
  ========================= */
  let reviewIndex = 0;

  activeServiceUsers.forEach(su => {
    const owner = sufpOwnerMap[su.suid];
    let attempts = 0;

    while (attempts < staffPool.length) {
      const staff = staffPool[reviewIndex];

      if (
        staff.username !== owner &&
        (staff.reviewCap === null || staff.reviewAssigned < staff.reviewCap)
      ) {
       newAssignments.push({
  month,
  type: "REVIEW",
  staff: staff.username,
  suid: su.suid
});


        staff.reviewAssigned++;
        reviewIndex = (reviewIndex + 1) % staffPool.length;
        return;
      }

      reviewIndex = (reviewIndex + 1) % staffPool.length;
      attempts++;
    }
  });

  /* =========================
     🔹 SAVE TO SUPABASE
  ========================= */
  const { error: insertError } = await supabase
    .from("sufp_assignments")
    .insert(newAssignments);

  if (insertError) {
    console.error(insertError);
    alert("Failed to save SUFP assignments");
    return;
  }

 alert("SUFP and Review tasks assigned correctly");
restoreDashboard();
}




let currentMyTaskType = "SUFP";

async function openMyTasks(type) {
  currentMyTaskType = type;

  closeAllMenus();
  hideAllPanels();

  const tbody = document.getElementById("myTasksBody");
  const monthRow = document.getElementById("myTasksMonthRow");

  /* =========================
     ARM VIEW (NO MONTH)
  ========================= */
  if (type === "ARM") {
    if (monthRow) monthRow.style.display = "none";

    /* 🔹 LOAD ARM ASSIGNMENTS FROM SUPABASE */
    const { data, error } = await supabase
     .from("arm_assignments")
.select("area_manager")
.eq("staff", currentUsername);

    if (error) {
      console.error(error);
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center text-danger">
            Failed to load ARM assignments
          </td>
        </tr>
      `;
      document.getElementById("myTasksPanel").style.display = "block";
      return;
    }

    const myAreaManagers = (data || []).map(r => r.area_manager);

    tbody.innerHTML = "";

    if (!myAreaManagers.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center text-muted">
            No Area Managers assigned to you
          </td>
        </tr>
      `;
    } else {
      myAreaManagers.forEach((am, index) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${index + 1}</td>
          <td colspan="7">${am}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    document.getElementById("myTasksPanel").style.display = "block";
    return;
  }

  /* =========================
     NORMAL TASK VIEW
  ========================= */
  if (monthRow) monthRow.style.display = "block";

  const monthInput = document.getElementById("myTasksMonth");
  monthInput.value = "";

  tbody.innerHTML = `
    <tr>
      <td colspan="8" class="text-center text-muted">
        Select month to view ${type} tasks
      </td>
    </tr>
  `;

  document.getElementById("myTasksPanel").style.display = "block";

  ["taskSearchSUID", "taskSearchPR", "taskSearchLM", "taskSearchAM"]
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
}



function onMyTasksMonthChange() {
  loadMyTasks();
}


async function loadMyTasks() {
  const month = document.getElementById("myTasksMonth").value;
  const tbody = document.getElementById("myTasksBody");
  tbody.innerHTML = "";

  if (!month) return;

  /* =========================
     🔹 LOAD LOGGED-IN STAFF
  ========================= */
  const { data: staff, error: staffError } = await supabase
    .from("users")
    .select("username")
    .eq("role", "Staff")
    .eq("username", currentUsername)
    .single();

  if (staffError || !staff) {
    console.error(staffError);
    return;
  }

  /* =========================
     🔹 LOAD ASSIGNMENTS
  ========================= */
 const { data: assignments, error: asgError } = await supabase
  .from("sufp_assignments")
  .select("suid, month, type, staff")
  .eq("month", month)
  .eq("staff", staff.username)
  .eq("type", currentMyTaskType);


  if (asgError) {
    console.error(asgError);
    alert("Failed to load tasks");
    return;
  }

  myTasksCache = assignments || [];

  if (!myTasksCache.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-muted">
          No tasks assigned for this month
        </td>
      </tr>
    `;
    return;
  }

  /* =========================
     🔹 LOAD SUPPORTING DATA
  ========================= */
  const [serviceUsersRes, dataSubsRes, detailsRes] = await Promise.all([
    supabase.from("service_users").select("*"),
    supabase.from("data_submissions").select("*").eq("month", month),
    supabase.from("sufp_task_details").select("*").eq("month", month)
  ]);

  const serviceUsers = serviceUsersRes.data || [];
  const dataSubs = dataSubsRes.data || [];
  const sufpDetails = detailsRes.data || [];

  /* =========================
     🔹 RENDER TABLE
  ========================= */
  for (let index = 0; index < myTasksCache.length; index++) {
    const task = myTasksCache[index];

    const su =
  serviceUsers.find(s => s.suid === task.suid) || {};


    const mgr =
      (await getManagersForPRByMonth(su.propertyid, month)) || su;

    const record = dataSubs.find(
      d =>
        d.prid === su.propertyid &&
        d.month === month
    );

    const mfrText = record?.mfr
      ? "MFR Received"
      : "MFR Not Received";

    const mfrClass = record?.mfr
      ? "text-success fw-bold"
      : "text-muted";

  const detail = sufpDetails.find(
  d =>
    d.suid === task.suid &&
    d.month === task.month &&
    d.type === task.type
);

    const statusText = detail
      ? detail.status === "COMPLETED"
        ? "Completed"
        : "In Progress"
      : "Pending";

    const statusClass = detail
      ? detail.status === "COMPLETED"
        ? "text-success fw-bold"
        : "text-warning fw-bold"
      : "text-muted";

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${task.type}</td>
      <td>${task.suid}</td>
      <td>${su.fullName || ""}</td>
      <td>${su.propertyid || ""}</td>
      <td>${mgr.linemanager || ""}</td>
      <td>${mgr.areamanager || ""}</td>
      <td class="${mfrClass}">${mfrText}</td>
      <td class="${statusClass}">${statusText}</td>
      <td style="max-width:200px; white-space:pre-wrap;">
        ${detail?.comments || "-"}
      </td>
    `;

    row.style.cursor = "pointer";
    row.onmouseenter = () => row.classList.add("table-active");
    row.onmouseleave = () => row.classList.remove("table-active");

    row.onclick = () =>
  openSUFPDetail(task.suid, month, task.type);

    tbody.appendChild(row);
  }
}

function toggleMyTasksSubMenu() {
  const submenu = document.getElementById("myTasksSubMenu");

  if (!submenu) return;

  submenu.style.display =
    submenu.style.display === "block" ? "none" : "block";
}
async function filterMyTasks() {
  const suid = document.getElementById("taskSearchSUID").value.toLowerCase();
  const pr = document.getElementById("taskSearchPR").value.toLowerCase();
  const lm = document.getElementById("taskSearchLM").value.toLowerCase();
  const am = document.getElementById("taskSearchAM").value.toLowerCase();

  const tbody = document.getElementById("myTasksBody");
  tbody.innerHTML = "";

  /* =========================
     🔹 LOAD REQUIRED DATA
  ========================= */
  const [serviceUsersRes, detailsRes] = await Promise.all([
    supabase.from("service_users").select("*"),
    supabase.from("sufp_task_details").select("*")
  ]);

  const serviceUsers = serviceUsersRes.data || [];
  const sufpDetails = detailsRes.data || [];

  /* =========================
     🔹 FILTER CACHE
  ========================= */
  const filtered = [];

  for (const task of myTasksCache) {
    const su =
  serviceUsers.find(s => s.suid === task.suid) || {};

    const mgr =
      (await getManagersForPRByMonth(su.propertyid, task.month)) || su;

    const match =
      (!suid || task.suid.toLowerCase().includes(suid)) &&
      (!pr || (su.propertyid|| "").toLowerCase().includes(pr)) &&
      (!lm || (mgr.linemanager || "").toLowerCase().includes(lm)) &&
      (!am || (mgr.areamanager || "").toLowerCase().includes(am));

    if (match) {
      filtered.push({ task, su, mgr });
    }
  }

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center text-muted">
          No matching tasks
        </td>
      </tr>
    `;
    return;
  }

  /* =========================
     🔹 RENDER TABLE
  ========================= */
  filtered.forEach(({ task, su, mgr }, index) => {
   const detail = sufpDetails.find(
  d =>
    d.suid === task.suid &&
    d.month === month &&
    d.type === task.type
);


    const statusText = detail
      ? detail.status === "COMPLETED"
        ? "Completed"
        : "In Progress"
      : "Pending";

    const statusClass = detail
      ? detail.status === "COMPLETED"
        ? "text-success fw-bold"
        : "text-warning fw-bold"
      : "text-muted";

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${task.type}</td>
      <td>${task.suid}</td>
      <td>${su.fullName || ""}</td>
      <td>${su.propertyid || ""}</td>
      <td>${mgr.linemanager || ""}</td>
      <td>${mgr.areamanager || ""}</td>
      <td class="${statusClass}">${statusText}</td>
      <td style="max-width:200px; white-space:pre-wrap;">
        ${detail?.comments || "-"}
      </td>
    `;

    tbody.appendChild(row);
  });
}

async function deleteAssignmentsForMonth(month) {
  if (!month) {
    alert("Please select a month first");
    return;
  }

  if (!confirm(`Delete ALL assignments for ${month}?`)) return;

  /* =========================
     🔹 DELETE FROM SUPABASE
  ========================= */
  const { error } = await supabase
    .from("sufp_assignments")
    .delete()
    .eq("month", month);

  if (error) {
    console.error(error);
    alert("Failed to delete assignments for " + month);
    return;
  }

  alert("Assignments deleted for " + month);

  const statusBox = document.getElementById("assignmentStatus");
  if (statusBox) {
    statusBox.style.display = "none";
    statusBox.innerHTML = "";
  }
}

function openAssignDataSubmissionForm() {
  closeAllMenus();
  hideAllPanels();

  document.getElementById("dsAdminMonth").value = "";
  document.getElementById("dsStaffCheckboxList").innerHTML = "";

  document.getElementById("assignDataSubmissionForm").style.display = "block";
}

async function loadDataSubmissionResponsibility() {
  const month = document.getElementById("dsAdminMonth").value;
  const container = document.getElementById("dsStaffCheckboxList");
  container.innerHTML = "";

  if (!month) return;

  /* =========================
     🔹 LOAD STAFF USERS
  ========================= */
  const { data: staffUsers, error: userError } = await supabase
    .from("users")
    .select("username, name")
    .eq("role", "Staff");

  if (userError) {
    console.error(userError);
    alert("Failed to load staff users");
    return;
  }

  /* =========================
     🔹 LOAD SAVED RESPONSIBILITY
  ========================= */
  const { data: saved, error: respError } = await supabase
    .from("data_submission_responsibility")
    .select("staff")
    .eq("month", month)
    .single();

  if (respError && respError.code !== "PGRST116") {
    // PGRST116 = no rows found (safe to ignore)
    console.error(respError);
    alert("Failed to load saved responsibility");
    return;
  }

  const selectedStaff = saved?.staff || [];

  /* =========================
     🔹 RENDER CHECKBOXES (UNCHANGED)
  ========================= */
  staffUsers.forEach(user => {
    const div = document.createElement("div");
    div.className = "form-check mb-1";

    const checked = selectedStaff.includes(user.username);

    div.innerHTML = `
      <input class="form-check-input"
             type="checkbox"
             value="${user.username}"
             id="ds_${user.username}"
             ${checked ? "checked" : ""}>
      <label class="form-check-label" for="ds_${user.username}">
        ${user.name}
      </label>
    `;

    container.appendChild(div);
  });
}


async function saveDataSubmissionResponsibility() {
  const month = document.getElementById("dsAdminMonth").value;
  if (!month) {
    alert("Please select month");
    return;
  }

  const checkboxes = document.querySelectorAll(
    "#dsStaffCheckboxList input[type=checkbox]"
  );

  const selectedStaff = Array.from(checkboxes)
    .filter(cb => cb.checked)
    .map(cb => cb.value);

  /* =========================
     🔹 UPSERT TO SUPABASE
  ========================= */
  const { error } = await supabase
    .from("data_submission_responsibility")
    .upsert(
      {
        month,
        staff: selectedStaff
      },
      { onConflict: "month" }
    );

  if (error) {
    console.error(error);
    alert("Failed to save Data Submission responsibility");
    return;
  }

alert("Data Submission responsibility saved");
restoreDashboard();
}

function openStaffDataSubmission() {
  closeAllMenus();
  hideAllPanels();
  document.getElementById("dataSubmissionPanel").style.display = "block";
}

function loadStaffDataSubmission() {
  renderStaffDataSubmission();
}

async function renderStaffDataSubmission() {
  const month = document.getElementById("dsStaffMonth").value;
  const tbody = document.getElementById("dsStaffTableBody");
  tbody.innerHTML = "";

  if (!month) return;

  /* =========================
     🔹 LOAD REQUIRED DATA
  ========================= */
  const [serviceUsersRes, dataSubsRes] = await Promise.all([
    supabase.from("service_users").select("*"),
    supabase.from("data_submissions").select("*").eq("month", month)
  ]);

  const serviceUsers = serviceUsersRes.data || [];
  const dataSubs = dataSubsRes.data || [];

  /* =========================
     🔹 BUILD UNIQUE PROPERTIES
  ========================= */
  const properties = {};

  serviceUsers.forEach(su => {
    if (!su.propertyid) return;

    if (!properties[su.propertyid]) {
      properties[su.propertyid] = {
        prid: su.propertyid
      };
    }
  });

  /* =========================
     🔹 FILTER INPUTS
  ========================= */
  const pr = document.getElementById("dsFilterPR").value.toLowerCase();
  const lm = document.getElementById("dsFilterLM").value.toLowerCase();
  const am = document.getElementById("dsFilterAM").value.toLowerCase();
  const mfrFilter = document.getElementById("dsFilterMFR").value;

  let i = 1;

  /* =========================
     🔹 RENDER ROWS
  ========================= */
  for (const p of Object.values(properties)) {
    const suFallback =
      serviceUsers.find(
        su => su.propertyid === p.prid && su.active
      ) || {};

    const mgr =
      (await getManagersForPRByMonth(p.prid, month)) || {
        linemanager: suFallback.linemanager || "-",
        areamanager: suFallback.areamanager || "-"
      };

    const record = dataSubs.find(
      d => d.prid === p.prid && d.month === month
    );

    const received = record ? record.mfr === true : false;

    /* =========================
       🔹 APPLY FILTERS
    ========================= */
    if (pr && !p.prid.toLowerCase().includes(pr)) continue;
    if (lm && !(mgr.linemanager || "").toLowerCase().includes(lm)) continue;
    if (am && !(mgr.areamanager || "").toLowerCase().includes(am)) continue;
    if (mfrFilter === "received" && !received) continue;
    if (mfrFilter === "not_received" && received) continue;

    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";
    tr.onmouseenter = () => tr.classList.add("table-active");
    tr.onmouseleave = () => tr.classList.remove("table-active");

    tr.onclick = () =>
      openDSDetail(p.prid, month);

    tr.innerHTML = `
      <td>${i++}</td>
      <td>${p.prid}</td>
      <td>${mgr.linemanager || "-"}</td>
      <td>${mgr.areamanager || "-"}</td>

      <td>
        <span class="badge ${record?.mfr ? "bg-success" : "bg-secondary"}">
          ${record?.mfr ? "Received" : "Not Received"}
        </span>
      </td>

      <td>
        <span class="badge ${record?.house_cash? "bg-success" : "bg-secondary"}">
          ${record?.house_cash ? "Received" : "Not Received"}
        </span>
      </td>

      <td>
        <span class="badge ${record?.safe_log ? "bg-success" : "bg-secondary"}">
          ${record?.safe_log ? "Received" : "Not Received"}
        </span>
      </td>

      <td>
        <span class="badge ${record?.house_receipt ? "bg-success" : "bg-secondary"}">
          ${record?.house_receipt ? "Received" : "Not Received"}
        </span>
      </td>

      <td>${record?.ticket_no || "-"}</td>
      <td style="max-width:250px; white-space:pre-wrap;">
        ${record?.comments || "-"}
      </td>
    `;

    tbody.appendChild(tr);
  }
}



async function openDSDetail(prid, month) {
  setDSReadOnly(true);

  // store hidden values
  document.getElementById("dsDetailPR").value = prid;
  document.getElementById("dsDetailMonth").value = month;

  /* =========================
     🔹 LOAD DATA SUBMISSION
  ========================= */
  const { data: record, error: recError } = await supabase
    .from("data_submissions")
    .select("*")
    .eq("prid", prid)
    .eq("month", month)
    .single();

  if (recError && recError.code !== "PGRST116") {
    console.error(recError);
    alert("Failed to load data submission");
    return;
  }

  const fileInfoDiv = document.getElementById("dsMFRFileInfo");
  const fileInput = document.getElementById("dsMFRFile");

  fileInput.value = ""; // ALWAYS reset (browser rule)

  if (record && record.mfr_file) {
    fileInfoDiv.style.display = "block";
    fileInfoDiv.innerHTML = `
      <strong>Uploaded file:</strong>
      ${record.mfr_file.systemName}
      <br>
      <small class="text-muted">
        Uploaded on ${new Date(record.mfr_file.uploadedAt).toLocaleString()}
      </small>
    `;
  } else {
    fileInfoDiv.style.display = "none";
    fileInfoDiv.innerHTML = "";
  }

  // populate fields if record exists
  document.getElementById("dsMFR").checked = record?.mfr || false;
  document.getElementById("dsHouseCash").checked = record?.house_cash || false;
  document.getElementById("dsSafeLog").checked = record?.safe_log || false;
  document.getElementById("dsHouseReceipt").checked = record?.house_receipt || false;
  document.getElementById("dsTicketNo").value = record?.ticket_no || "";
  document.getElementById("dsComments").value = record?.comments || "";

  /* =========================
     🔹 LOAD SERVICE USER (FALLBACK)
  ========================= */
  const { data: serviceUsers } = await supabase
    .from("service_users")
    .select("*")
    .eq("propertyid", prid)
    .eq("active", true);

  const su = serviceUsers?.[0] || {};

  /* =========================
     🔹 LOAD MANAGERS (BY MONTH)
  ========================= */
  const mgr =
    (await getManagersForPRByMonth(prid, month)) || {
      linemanager: su.linemanager || "-",
      areamanager: su.areamanager || "-"
    };

  // show visible context
  document.getElementById("dsDetailPRText").innerText = prid;
  document.getElementById("dsDetailLM").innerText = mgr.linemanager || "-";
  document.getElementById("dsDetailAM").innerText = mgr.areamanager
 || "-";

  hideAllPanels();
  document.getElementById("dsDetailForm").style.display = "block";
  setDSReadOnly(true);
}

async function saveDSDetail() {
  const prid = document.getElementById("dsDetailPR").value;
  const month = document.getElementById("dsDetailMonth").value;

  if (!prid || !month) {
    alert("Invalid property or month");
    return;
  }

  const fileMeta = getUploadedMFRFileMeta(prid, month);

  // 🚫 MFR file is mandatory ONLY if MFR is checked
  if (document.getElementById("dsMFR").checked && !fileMeta) {
    alert("Please upload MFR file before saving.");
    return;
  }

  /* =========================
     🔹 LOAD EXISTING RECORD (IF ANY)
  ========================= */
  const { data: existing, error: loadError } = await supabase
    .from("data_submissions")
    .select("mfr_file")
    .eq("prid", prid)
    .eq("month", month)
    .single();

  if (loadError && loadError.code !== "PGRST116") {
    console.error(loadError);
    alert("Failed to load existing submission");
    return;
  }

const record = {
  prid,
  month,
  mfr: document.getElementById("dsMFR").checked,
  house_cash: document.getElementById("dsHouseCash").checked,
  safe_log: document.getElementById("dsSafeLog").checked,
  house_receipt: document.getElementById("dsHouseReceipt").checked,
  ticket_no: document.getElementById("dsTicketNo").value.trim(),
  comments: document.getElementById("dsComments").value.trim(),
  mfr_file: fileMeta || existing?.mfr_file || null,
  updated_at: new Date().toISOString()
};

  /* =========================
     🔹 UPSERT TO SUPABASE
  ========================= */
  const { error: saveError } = await supabase
    .from("data_submissions")
    .upsert(record, { onConflict: "prid,month" });

  if (saveError) {
    console.error(saveError);
    alert("Failed to save data submission");
    return;
  }

  /* =========================
     🔹 SYNC ARM ISSUES
  ========================= */
  await syncARMIssues();

  alert("Data submission saved");

  setDSReadOnly(true);

  // explicitly close DETAIL form
  document.getElementById("dsDetailForm").style.display = "none";

  // show Data Submission list
  document.getElementById("dataSubmissionPanel").style.display = "block";

  // restore month
  document.getElementById("dsStaffMonth").value = month;

  // reload list
  renderStaffDataSubmission();
}
async function renderARMIssues() {
  if (!currentARMSelectedAM) return;

  const tbody = document.getElementById("armIssuesBody");
  tbody.innerHTML = "";

  const statusFilter =
    document.getElementById("armStatusFilter")?.value || "";

  /* =========================
     LOAD ARM ISSUES
  ========================= */
  const { data: issues, error } = await supabase
    .from("arm_issues")
    .select("*")
    .eq("area_manager", currentARMSelectedAM)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center text-danger">
          Failed to load ARM issues
        </td>
      </tr>
    `;
    return;
  }

  const filtered = (issues || []).filter(i =>
    !statusFilter || i.status === statusFilter
  );

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center text-muted">
          No issues found
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach((issue, index) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${issue.line_manager || "-"}</td>
      <td>${issue.prid || "-"}</td>
 <td>${issue.source_comment || "-"}</td>
<td>${issue.source === "SUFP" ? "SUFP" : "Data Submission"}</td>

      <td>${issue.month || "-"}</td>
      <td>${issue.suid || "-"}</td>
      <td>
        <select class="form-select form-select-sm"
                onchange="updateARMStatus('${issue.id}', this.value)">
          <option value="PENDING"
            ${issue.status === "PENDING" ? "selected" : ""}>
            Pending
          </option>
          <option value="RESOLVED"
            ${issue.status === "RESOLVED" ? "selected" : ""}>
            Resolved
          </option>
        </select>
      </td>
      <td>
        <textarea class="form-control form-control-sm"
                  rows="2"
                  placeholder="ARM comments..."
                  onchange="updateARMComment('${issue.id}', this.value)">
          ${issue.arm_comment || ""}
        </textarea>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

function setDSReadOnly(readonly) {
  document.getElementById("dsMFR").disabled = readonly;
  document.getElementById("dsHouseCash").disabled = readonly;
  document.getElementById("dsSafeLog").disabled = readonly;
  document.getElementById("dsHouseReceipt").disabled = readonly;

  document.getElementById("dsTicketNo").readOnly = readonly;
  document.getElementById("dsComments").readOnly = readonly;

  document.getElementById("dsEditBtn").classList.toggle("d-none", !readonly);
  document.getElementById("dsSaveBtn").classList.toggle("d-none", readonly);
}

function enableDSEdit() {
  setDSReadOnly(false);
}
async function saveSUFPDetail() {
  const suid = document.getElementById("sufpDetailSUID").value;
  const month = document.getElementById("sufpDetailMonth").value;
  const type = document.getElementById("sufpDetailType").value;

  const status = document.getElementById("sufpStatus").value;
  const malNumber = document.getElementById("sufpMalNumber").value.trim();
  const verifiedAmount = document.getElementById("sufpVerifiedAmount").value.trim();

  if (!status) {
    alert("Please select status");
    return;
  }

  if (status === "IN_PROGRESS" && !malNumber) {
    alert("Kindly add MAL number");
    return;
  }

  if (status === "COMPLETED" && !verifiedAmount) {
    alert("Verified amount is required");
    return;
  }

  const record = {
    suid, // ✅ MATCH COLUMN NAME
    month,
    type,
    status,
    comments: document.getElementById("sufpComments").value.trim(),
    mal_number: status === "IN_PROGRESS" ? malNumber : null,
    verified_amount:
      status === "COMPLETED" ? Number(verifiedAmount) : null,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from("sufp_task_details")
    .upsert(record, { onConflict: "suid,month,type" });

  if (error) {
    console.error("SUFP save error:", error);
    alert("Failed to save SUFP details");
    return;
  }

  alert("SUFP saved successfully");

  await syncARMIssues();

 setSUFPReadOnly(true);

currentMyTaskType = type;
document.getElementById("myTasksMonth").value = month;

openMyTasks(type);

}



/**************************************************
 * BULK DELETE SERVICE USERS (ADMIN ONLY)
 **************************************************/

function toggleSelectAllSU(master) {
  document.querySelectorAll(".su-select").forEach(cb => {
    cb.checked = master.checked;
  });
}

async function bulkDeleteServiceUsers() {
  if (currentUserRole !== "Admin") {
    alert("Access denied");
    return;
  }

  const selected = Array.from(
    document.querySelectorAll(".su-select:checked")
  ).map(cb => cb.value);

  if (!selected.length) {
    alert("No service users selected");
    return;
  }

  const currentMonth = new Date().toISOString().slice(0, 7);

  if (
    !confirm(
      `Delete ${selected.length} service user(s)?\n\n` +
      `✔ Past months data will be preserved\n` +
      `❌ Current & future tasks will be removed\n\n` +
      `This action cannot be undone.`
    )
  ) return;

  /* =========================
     1️⃣ DELETE SERVICE USERS
  ========================= */
  const { error: suError } = await supabase
    .from("service_users")
    .delete()
    .in("suid", selected);

  if (suError) {
    console.error(suError);
    alert("Failed to delete service users");
    return;
  }

  /* =========================
     2️⃣ CLEAN SUFP ASSIGNMENTS
        (KEEP PAST MONTHS)
  ========================= */
  const { error: sufpError } = await supabase
    .from("sufp_assignments")
    .delete()
    .in("suid", selected)
    .gte("month", currentMonth);

  if (sufpError) {
    console.error(sufpError);
    alert("Failed to clean SUFP assignments");
    return;
  }

  /* =========================
     3️⃣ CLEAN DATA SUBMISSIONS
        (KEEP PAST MONTHS)
  ========================= */

  // Get remaining service users (to know which PRs still exist)
  const { data: remainingSUs, error: remError } = await supabase
    .from("service_users")
    .select("propertyid");

  if (remError) {
    console.error(remError);
    alert("Failed to validate remaining service users");
    return;
  }

  const remainingPRs = new Set(
    (remainingSUs || []).map(su => su.propertyid)
  );

  // Load current & future submissions
  const { data: futureSubs, error: subLoadError } = await supabase
    .from("data_submissions")
    .select("id, prid, month")
    .gte("month", currentMonth);

  if (subLoadError) {
    console.error(subLoadError);
    alert("Failed to load data submissions");
    return;
  }

  // Delete only submissions whose PR no longer exists
  const toDelete = (futureSubs || [])
    .filter(d => !remainingPRs.has(d.prid))
    .map(d => d.id);

  if (toDelete.length) {
    const { error: delError } = await supabase
      .from("data_submissions")
      .delete()
      .in("id", toDelete);

    if (delError) {
      console.error(delError);
      alert("Failed to clean data submissions");
      return;
    }
  }

  alert(
    `${selected.length} service user(s) deleted.\n` +
    `Past months data preserved successfully.`
  );

  renderServiceUsersReport();
}

/**************************************************
 * STAFF DASHBOARD (CHARTS + STATS)
 **************************************************/

function openStaffDashboard() {
  hideAllPanels();

  document.getElementById("staffDashboardPanel").style.display = "block";

  const monthInput = document.getElementById("dashboardMonth");
  const taskSelect = document.getElementById("dashboardTaskType");

  // default month = current
  const today = new Date();

let year = today.getFullYear();
let month = today.getMonth(); // 0-based

// move to previous month
month -= 1;

if (month < 0) {
  month = 11;
  year -= 1;
}

// format YYYY-MM safely (no timezone issues)
monthInput.value =
  year + "-" + String(month + 1).padStart(2, "0");


  monthInput.onchange = refreshStaffDashboard;
  taskSelect.onchange = refreshStaffDashboard;

  refreshStaffDashboard();
}

async function refreshStaffDashboard() {
  const month =
    document.getElementById("dashboardMonth").value;
  const taskType =
    document.getElementById("dashboardTaskType").value;

  if (!month) return;

  /* =========================
     LOAD DATA FROM SUPABASE
  ========================= */

  const [
    { data: assignments },
    { data: sufpDetails },
    { data: dataSubs },
    { data: dsResp },
    { data: serviceUsers }
  ] = await Promise.all([
    supabase
      .from("sufp_assignments")
      .select("*")
      .eq("staff", currentUsername)
      .eq("month", month),

    supabase
      .from("sufp_task_details")
      .select("*")
      .eq("month", month),

    supabase
      .from("data_submissions")
      .select("*")
      .eq("month", month),

    supabase
      .from("data_submission_responsibility")
      .select("*")
      .eq("month", month)
      .limit(1),

    supabase
      .from("service_users")
      .select("suid, propertyid, active")
      .eq("active", true)
  ]);

  let total = 0;
  let completed = 0;
  let inProgress = 0;
  let pending = 0;

  /* =========================
     SUFP & REVIEW TASKS
  ========================= */
  if (taskType === "ALL" || taskType !== "DATA") {
    (assignments || [])
      .filter(a =>
        taskType === "ALL" || a.type === taskType
      )
      .forEach(task => {
        total++;

        const detail = (sufpDetails || []).find(
          d =>
            d.suid === task.suid &&
            d.month === task.month &&
            d.type === task.type
        );

        if (!detail) pending++;
        else if (detail.status === "COMPLETED") completed++;
        else if (detail.status === "IN_PROGRESS") inProgress++;
        else pending++;
      });
  }

  /* =========================
     DATA SUBMISSION TASKS
     (PERCENTAGE-BASED)
  ========================= */
  if (taskType === "ALL" || taskType === "DATA") {
    const resp = (dsResp || [])[0];

    if (resp && resp.staff?.includes(currentUsername)) {
      const properties = [
        ...new Set(
          (serviceUsers || [])
            .filter(su => su.propertyid)
            .map(su => su.propertyid)
        )
      ];

      const totalProperties = properties.length;
      const expectedDocs = totalProperties * 4;

      let receivedDocs = 0;

      properties.forEach(prid => {
        const record = (dataSubs || []).find(
          d => d.prid === prid && d.month === month
        );

        if (record) {
          if (record.mfr) receivedDocs++;
          if (record.house_cash) receivedDocs++;
          if (record.safe_log) receivedDocs++;
          if (record.house_receipt) receivedDocs++;
        }
      });

      const receivedPercent =
        expectedDocs === 0
          ? 0
          : (receivedDocs / expectedDocs) * 100;

      const completedPercent =
        Math.round(receivedPercent * 100) / 100;

      const pendingPercent =
        Math.round((100 - completedPercent) * 100) / 100;

     total += totalProperties;

completed += Math.round(
  (completedPercent / 100) * totalProperties
);

pending += totalProperties - 
  Math.round((completedPercent / 100) * totalProperties);
    }
  }

  /* =========================
     DASHBOARD TEXT STATS
  ========================= */
  document.getElementById("dashTotal").innerText = total;

  if (taskType === "DATA") {
    document.getElementById("dashCompleted").innerText =
      completed.toFixed(2) + "%";
    document.getElementById("dashPending").innerText =
      pending.toFixed(2) + "%";
    document.getElementById("dashInProgress").innerText = "0";
  } else {
    document.getElementById("dashCompleted").innerText = completed;
    document.getElementById("dashInProgress").innerText = inProgress;
    document.getElementById("dashPending").innerText = pending;
  }

  /* =========================
     BAR CHART (UNCHANGED)
  ========================= */
  const ctx =
    document.getElementById("dashboardBarChart");

  if (staffDashboardChart)
    staffDashboardChart.destroy();

  staffDashboardChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Completed", "In Progress", "Pending"],
      datasets: [{
        data: [completed, inProgress, pending],
        backgroundColor: [
          "rgba(34, 197, 94, 0.85)",
          "rgba(234, 179, 8, 0.85)",
          "rgba(148, 163, 184, 0.85)"
        ],
        borderRadius: 12,
        borderSkipped: false,
        barThickness: 48
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

let currentARMSelectedAM = null;

function openARMIssues(areamanager
) {
  closeAllMenus();
  hideAllPanels();

  currentARMSelectedAM = areamanager;
  document.getElementById("armSelectedAM").innerText = areamanager
;

  renderARMIssues();

  document.getElementById("armIssuesPanel").style.display = "block";
}
async function openARMForStaff() {
  closeAllMenus();
  hideAllPanels();

  const tbody = document.getElementById("armAreaManagerBody");
  tbody.innerHTML = "";

  /* =========================
     LOAD ARM ASSIGNMENTS
  ========================= */
  const { data, error } = await supabase
    .from("arm_assignments")
    .select("area_manager")
    .eq("staff", currentUsername);

  if (error) {
    console.error(error);
    tbody.innerHTML = `
      <tr>
        <td colspan="2" class="text-center text-danger">
          Failed to load ARM assignments
        </td>
      </tr>
    `;
    return;
  }

  const myAreaManagers = [
    ...new Set((data || []).map(r => r.area_manager))
  ];

  if (!myAreaManagers.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="2" class="text-center text-muted">
          No Area Managers assigned to you
        </td>
      </tr>
    `;
  } else {
    myAreaManagers.forEach((am, index) => {
      const tr = document.createElement("tr");
      tr.style.cursor = "pointer";

      tr.innerHTML = `
        <td>${index + 1}</td>
        <td>${am}</td>
      `;

      // keep original behavior
      syncARMIssues();

      tr.onclick = () => openARMIssues(am);

      tbody.appendChild(tr);
    });
  }

  document.getElementById("armAreaManagerPanel").style.display = "block";
}

async function updateARMStatus(id, status) {
  if (!id || !status) return;

  const { error } = await supabase
    .from("arm_issues")
    .update({
      status: status,
      updated_at: new Date().toISOString()
    })
    .eq("id", id);

  if (error) {
    console.error("Failed to update ARM status:", error);
    alert("Failed to update status");
  }
}




async function updateARMComment(id, comment) {
  if (!id) return;

  const { error } = await supabase
    .from("arm_issues")
    .update({
      arm_comment: comment?.trim() || "",
      updated_at: new Date().toISOString()
    })
    .eq("id", id);

  if (error) {
    console.error("Failed to update ARM comment:", error);
    alert("Failed to save ARM comment");
  }
}

async function renderAssignedSUFPReport() {
  const month =
    document.getElementById("assignedSUFPMonth").value;
  const staffFilter =
    document.getElementById("assignedSUFPStaffFilter").value.toLowerCase();

  const typeFilter =
    document.getElementById("assignedSUFPTypeFilter")?.value || "SUFP";

  const tbody =
    document.getElementById("assignedSUFPBody");
  tbody.innerHTML = "";

  if (!month) return;

  /* =========================
     LOAD DATA FROM SUPABASE
  ========================= */
const [
  { data: assignments },
  { data: serviceUsers },
  { data: details }
] = await Promise.all([
  supabase
    .from("sufp_assignments")
    .select("*")
    .eq("month", month)
    .eq("type", typeFilter),

  supabase
    .from("service_users")
    .select("suid, fullName, propertyid, linemanager, areamanager"),

  supabase
    .from("sufp_task_details")
    .select("suid, month, type, status")
    .eq("month", month)
    .eq("type", typeFilter)
]);


  /* =========================
     APPLY SAME FILTER LOGIC
  ========================= */
  const filtered = (assignments || []).filter(a => {
    if (!staffFilter) return true;

    const su =
  (serviceUsers || []).find(s => s.suid === a.suid) || {};

    return (
      a.staff.toLowerCase().includes(staffFilter) ||
      a.suid.toLowerCase().includes(staffFilter) ||
      (su.fullName || "").toLowerCase().includes(staffFilter) ||
      (su.propertyid || "").toLowerCase().includes(staffFilter)
    );
  });

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center text-muted">
          No assignments found
        </td>
      </tr>
    `;
    return;
  }

  /* =========================
     RENDER TABLE
  ========================= */
  filtered.forEach((a, index) => {
    const su =
  (serviceUsers || []).find(s => s.suid === a.suid) || {};

  const detail =
  (details || []).find(d =>
    d.suid === a.suid &&
    d.month === a.month &&
    d.type === a.type
  );

    const status = detail
      ? detail.status === "COMPLETED"
        ? "Completed"
        : "In Progress"
      : "Pending";

    const statusClass =
      status === "Completed"
        ? "text-success fw-bold"
        : status === "In Progress"
        ? "text-warning fw-bold"
        : "text-muted";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${formatMonthLabel(a.month)}</td>
      <td>${a.staff}</td>
      <td>${a.type}</td>
      <td>${a.suid}</td>
      <td>${su.fullName || ""}</td>
      <td>${su.propertyid || ""}</td>
      <td class="${statusClass}">
        ${status}
      </td>
    `;

    tbody.appendChild(tr);
  });
}

document.addEventListener("click", function (e) {
  const adminMenu = document.getElementById("rightSidebar");
  const staffMenu = document.getElementById("staffMenuPanel");
  const menuBtn = document.getElementById("menuBtn");

  // If click is inside admin menu, staff menu, or menu button → do nothing
  if (
    adminMenu?.contains(e.target) ||
    staffMenu?.contains(e.target) ||
    menuBtn?.contains(e.target)
  ) {
    return;
  }

  // Close admin menu (uses class)
  if (adminMenu && adminMenu.classList.contains("open")) {
    adminMenu.classList.remove("open");
  }

  // Close staff menu (uses display)
  if (staffMenu && staffMenu.style.display === "block") {
    staffMenu.style.display = "none";
  }
});
async function openAdminDashboard() {
  hideAllPanels();
  closeAllMenus();

  document.getElementById("adminDashboardPanel").style.display = "block";

  const monthInput = document.getElementById("adminDashMonth");
  const staffSelect = document.getElementById("adminDashStaff");
  const taskTypeSelect = document.getElementById("adminDashTaskType");

  /* =========================
     DEFAULT MONTH = PREVIOUS
  ========================= */
  const today = new Date();
  let y = today.getFullYear();
  let m = today.getMonth() - 1;

  if (m < 0) {
    m = 11;
    y -= 1;
  }

  monthInput.value =
    y + "-" + String(m + 1).padStart(2, "0");

  /* =========================
     LOAD STAFF FROM SUPABASE
  ========================= */
  staffSelect.innerHTML =
    `<option value="ALL">All Staff</option>`;

  const { data: users, error } = await supabase
    .from("users")
    .select("username, name")
    .eq("role", "Staff");

  if (error) {
    console.error(error);
    alert("Failed to load staff list");
    return;
  }

  (users || []).forEach(u => {
    const opt = document.createElement("option");
    opt.value = u.username;
    opt.textContent = u.name;
    staffSelect.appendChild(opt);
  });

  /* =========================
     EVENT LISTENERS
  ========================= */
  monthInput.onchange = refreshAdminDashboard;
  staffSelect.onchange = refreshAdminDashboard;
  taskTypeSelect.onchange = refreshAdminDashboard;

  document.getElementById("adminStaffTimeRange").onchange = () => {
    handleAdminStaffTimeRangeUI();
    setTimeout(() => {
      refreshAdminDashboard();
    }, 0);
  };

  document.getElementById("adminStaffWeek").onchange =
    refreshAdminDashboard;

  document.getElementById("adminStaffDate").onchange =
    refreshAdminDashboard;

  handleAdminStaffTimeRangeUI();
  refreshAdminDashboard();
}


async function refreshAdminDashboard() {
  const month = document.getElementById("adminDashMonth").value;
  const staffFilter = document.getElementById("adminDashStaff").value;
  const taskType = document.getElementById("adminDashTaskType").value;

  if (!month) return;

  /* =========================
     LOAD DATA FROM SUPABASE
  ========================= */
  const [
    { data: assignments },
    { data: sufpDetails },
    { data: serviceUsers },
    { data: dataSubs },
    { data: dsResp }
  ] = await Promise.all([
    supabase.from("sufp_assignments").select("*").eq("month", month),
    supabase.from("sufp_task_details").select("*").eq("month", month),
    supabase.from("service_users").select("suid, propertyid, active"),
    supabase.from("data_submissions").select("*").eq("month", month),
    supabase
      .from("data_submission_responsibility")
      .select("*")
      .eq("month", month)
  ]);

  let total = 0;
  let completed = 0;
  let inProgress = 0;
  let pending = 0;

  /* =========================
     SUFP + REVIEW
  ========================= */
  if (taskType !== "DATA") {
    (assignments || [])
      .filter(a =>
        a.month === month &&
        (staffFilter === "ALL" || a.staff === staffFilter) &&
        (taskType === "ALL" || a.type === taskType)
      )
      .forEach(a => {
        total++;

        const detail = (sufpDetails || []).find(
          d =>
            d.suid === a.suid &&
            d.month === a.month &&
            d.type === a.type
        );

        if (!detail) pending++;
        else if (detail.status === "COMPLETED") completed++;
        else if (detail.status === "IN_PROGRESS") inProgress++;
        else pending++;
      });
  }

  /* =========================
     DATA SUBMISSION (PERCENTAGE)
  ========================= */
  let dataPercent = 0;

  if (taskType === "ALL" || taskType === "DATA") {
    const resp = (dsResp || []).find(
      r =>
        r.month === month &&
        (staffFilter === "ALL" ||
          r.staff.includes(staffFilter))
    );

    if (resp) {
      const properties = [
        ...new Set(
          (serviceUsers || [])
            .filter(su => su.active && su.propertyid)
            .map(su => su.propertyid)
        )
      ];

      const expectedDocs = properties.length * 4;
      let receivedDocs = 0;

      properties.forEach(prid => {
        const r = (dataSubs || []).find(
          d => d.prid === prid && d.month === month
        );

        if (r) {
          if (r.mfr) receivedDocs++;
          if (r.house_cash) receivedDocs++;
          if (r.safe_log) receivedDocs++;
          if (r.house_receipt) receivedDocs++;
        }
      });

      dataPercent =
        expectedDocs === 0
          ? 0
          : Math.round((receivedDocs / expectedDocs) * 10000) / 100;
    }
  }

  /* =========================
     KPI + CHART OUTPUT
  ========================= */
  const completionPercent =
    total === 0
      ? 0
      : Math.round((completed / total) * 10000) / 100;

/* =========================
   WRITE KPI TEXT (🔥 FIX)
========================= */
document.getElementById("kpiTotal").innerText = total;
document.getElementById("kpiCompleted").innerText = completed;
document.getElementById("kpiPending").innerText = pending;

document.getElementById("kpiPercent").innerText =
  total === 0
    ? "0%"
    : Math.round((completed / total) * 100) + "%";

/* =========================
   CHARTS
========================= */
renderAdminTrendChart(month, taskType);
renderAdminStaffPerformanceUnified(month, taskType);
renderAdminPieChartFromKPIs(completed, inProgress, pending);


}

function renderAdminPieChartFromKPIs(completed, inProgress, pending) {
  const ctx = document.getElementById("adminPieChart");
  if (!ctx) return;

  // prevent Chart.js zero-sum crash
  if (completed === 0 && inProgress === 0 && pending === 0) {
    pending = 0.01;
  }

  if (adminPieChart) adminPieChart.destroy();

  adminPieChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["Completed", "In Progress", "Pending"],
      datasets: [
        // shadow layer (fake 3D)
        {
          data: [completed, inProgress, pending],
          backgroundColor: [
            "rgba(34,197,94,0.35)",
            "rgba(234,179,8,0.35)",
            "rgba(148,163,184,0.35)"
          ],
          radius: "100%",
          borderWidth: 0
        },
        // top layer
        {
          data: [completed, inProgress, pending],
          backgroundColor: [
            "rgba(34,197,94,0.95)",   // green
            "rgba(234,179,8,0.95)",   // amber
            "rgba(148,163,184,0.95)"  // grey
          ],
          radius: "90%",
          borderColor: "#fff",
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: ctx =>
              `${ctx.label}: ${ctx.parsed}`
          }
        }
      }
    }
  });
}

async function renderAdminTrendChart(month, taskType) {
  const ctx = document.getElementById("adminTrendChart");
  if (!ctx) return;

  if (taskType === "DATA") {
    if (adminTrendChart) adminTrendChart.destroy();
    return;
  }

  /* =========================
     LOAD DATA FROM SUPABASE
  ========================= */
  const [
    { data: assignments },
    { data: sufpDetails }
  ] = await Promise.all([
    supabase
      .from("sufp_assignments")
      .select("suid, month, type")
      .eq("month", month),

    supabase
      .from("sufp_task_details")
      .select("suid, month, type, status, updated_at")
      .eq("month", month)
      .eq("status", "COMPLETED")
  ]);

  const dailyMap = {};

  (assignments || [])
    .filter(a =>
      a.month === month &&
      (taskType === "ALL" || a.type === taskType)
    )
    .forEach(a => {
      const detail = (sufpDetails || []).find(
        d =>
          d.suid === a.suid &&
          d.month === a.month &&
          d.type === a.type
      );

      if (!detail || !detail.updated_at) return;

      const day = new Date(detail.updated_at).getDate();
      dailyMap[day] = (dailyMap[day] || 0) + 1;
    });

  const labels = Object.keys(dailyMap).sort((a, b) => a - b);
  const data = labels.map(d => dailyMap[d]);

  if (adminTrendChart) adminTrendChart.destroy();

  adminTrendChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Completed Tasks",
        data,
        borderColor: "rgba(59,130,246,0.9)",
        backgroundColor: "rgba(59,130,246,0.15)",
        tension: 0.35,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 }
        }
      }
    }
  });
}

async function renderAdminStaffPerformanceUnified(month, taskType) {
  const ctx =
    document.getElementById("adminStaffPerformanceChart");
  if (!ctx) return;

  const range =
    document.getElementById("adminStaffTimeRange").value;
  const selectedWeek =
    document.getElementById("adminStaffWeek").value;
  const selectedDate =
    document.getElementById("adminStaffDate").value;

  /* =========================
     LOAD DATA FROM SUPABASE
  ========================= */
  const [
    { data: assignments },
    { data: details },
    { data: users }
  ] = await Promise.all([
    supabase
      .from("sufp_assignments")
      .select("*")
      .eq("month", month),

    supabase
      .from("sufp_task_details")
      .select("*")
      .eq("month", month)
      .eq("status", "COMPLETED"),

    supabase
      .from("users")
      .select("username, name, role")
      .eq("role", "Staff")
  ]);

  const staffUsers = users || [];

  const labels = [];
  const data = [];

  staffUsers.forEach(staff => {
    let count = 0;

    (assignments || [])
      .filter(a =>
        a.staff === staff.username &&
        a.month === month &&
        (taskType === "ALL" || a.type === taskType)
      )
      .forEach(a => {
        const d = (details || []).find(
          x =>
            x.suid === a.suid &&
            x.month === a.month &&
            x.type === a.type
        );
  if (!d || !d.updated_at) return;
const doneDate = new Date(d.updated_at);


        // DAILY filter
        if (
          range === "DAILY" &&
          doneDate.toISOString().slice(0, 10) !== selectedDate
        ) return;

        // WEEKLY filter
        if (
          range === "WEEKLY" &&
          getWeekOfMonthSimple(doneDate) !== Number(selectedWeek)
        ) return;

        count++;
      });

    labels.push(staff.name);
    data.push(count);
  });

  if (adminStaffPerformanceChart)
    adminStaffPerformanceChart.destroy();

  adminStaffPerformanceChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor:
          taskType === "REVIEW"
            ? "rgba(148,163,184,0.85)"
            : taskType === "DATA"
            ? "rgba(168,85,247,0.85)"
            : "rgba(59,130,246,0.85)",
        borderRadius: 8,
        barThickness: 28
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 }
        }
      }
    }
  });
}

function exportAssignedSUFPExcel() {
  const tbody = document.getElementById("assignedSUFPBody");

  if (!tbody || tbody.children.length === 0) {
    alert("No data to export");
    return;
  }

  const rows = [];

  // Header row
  rows.push([
    "Month",
    "Staff",
    "Task Type",
    "SUID",
    "Service User",
    "PR ID",
    "Status"
  ]);

  Array.from(tbody.children).forEach(tr => {
    const td = tr.querySelectorAll("td");
    if (td.length < 8) return;

    rows.push([
      td[1].innerText.trim(), // Month
      td[2].innerText.trim(), // Staff
      td[3].innerText.trim(), // Type
      td[4].innerText.trim(), // SUID
      td[5].innerText.trim(), // Service User
      td[6].innerText.trim(), // PR ID
      td[7].innerText.trim()  // Status
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Assigned SUFP");

  const month =
    document.getElementById("assignedSUFPMonth")?.value || "All";

  XLSX.writeFile(wb, `Assigned_SUFP_Report_${month}.xlsx`);
}
function formatMonthToShort(month) {
  if (!month) return "";

  const [year, m] = month.split("-");
  const monthNames = [
    "Jan","Feb","Mar","Apr","May","Jun",
    "Jul","Aug","Sep","Oct","Nov","Dec"
  ];

  const monthIndex = parseInt(m, 10) - 1;
  const shortYear = year.slice(-2);

  return `${monthNames[monthIndex]}-${shortYear}`;
}
async function exportARMIssuesExcel() {
  const tbody = document.getElementById("armIssuesBody");
  const selectedAM =
    document.getElementById("armSelectedAM")?.innerText || "";

  if (!tbody || tbody.children.length === 0) {
    alert("No ARM issues to export");
    return;
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("ARM Queries");

  /* =========================
     ADD LOGO (TOP LEFT)
  ========================= */
  const logoUrl = "https://gzrlsrljpknelxuijepf.supabase.co/storage/v1/object/public/logo.png/1516883020539.jpg";

  const response = await fetch(logoUrl);
  const bufferImage = await response.arrayBuffer();

  const logoId = workbook.addImage({
    buffer: bufferImage,
    extension: "jpeg"
  });

  worksheet.addImage(logoId, {
    tl: { col: 0, row: 0 },
    ext: { width: 220, height: 85 }
  });

  /* =========================
     COLUMN WIDTHS
  ========================= */
  worksheet.columns = [
    { width: 8 },
    { width: 20 },
    { width: 15 },
    { width: 30 },
    { width: 22 },
    { width: 12 },
    { width: 12 },
    { width: 15 },
    { width: 30 }
  ];

  let rowNumber = 6; // Leave space for logo

  /* =========================
     COMPANY INFO
  ========================= */
  const companyInfo = [
    "Comfort Care Services UK Ltd",
    "Unit 2, Progress Business Centre",
    "Whittle Park Way",
    "Slough",
    "Berkshire",
    "SL1 6DQ",
    "Tel : 01628600412",
    "Email : finance@comfortcareservices.com",
    "Company registration number 05153873"
  ];

  companyInfo.forEach(text => {
    const cell = worksheet.getCell(`A${rowNumber}`);
    cell.value = text;
    cell.font = { size: 10 };
    rowNumber++;
  });

  rowNumber += 1;

  /* =========================
     MEETING DAY ROW
  ========================= */
  worksheet.getCell(`A${rowNumber}`).value = "Meeting Day";
  worksheet.getCell(`B${rowNumber}`).value = "20-Jan-26";

  worksheet.getCell(`A${rowNumber}`).font = { bold: true };
  worksheet.getCell(`B${rowNumber}`).font = { bold: true };

  worksheet.getCell(`A${rowNumber}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "D9E1F2" }
  };

  worksheet.getCell(`B${rowNumber}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "D9E1F2" }
  };

  rowNumber += 2;

  /* =========================
     TITLE
  ========================= */
  worksheet.mergeCells(`A${rowNumber}:I${rowNumber}`);

  const titleCell = worksheet.getCell(`A${rowNumber}`);
  titleCell.value = `${selectedAM} ARM Queries`;

  titleCell.font = {
    bold: true,
    size: 16
  };

  titleCell.alignment = {
    horizontal: "center"
  };

  rowNumber += 2;

  /* =========================
     TABLE HEADER
  ========================= */
  const headerRow = worksheet.addRow([
    "Sr no.",
    "Line Manager",
    "PRID",
    "Query",
    "Documents",
    "Month",
    "SUID",
    "Status",
    "ARM Comments"
  ]);

  headerRow.font = {
    bold: true,
    color: { argb: "FFFFFFFF" }
  };

  headerRow.eachCell(cell => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "44546A" }
    };

    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
  });

  /* =========================
     TABLE DATA
  ========================= */
  Array.from(tbody.children).forEach((tr, index) => {
    const td = tr.querySelectorAll("td");

    const row = worksheet.addRow([
      index + 1,
      td[1].innerText.trim(),
      td[2].innerText.trim(),
      td[3].innerText.trim(),
      td[4].innerText.trim(),
    formatMonthToShort(td[5].innerText.trim()),
      td[6].innerText.trim(),
      td[7].querySelector("select")?.value || "",
      td[8].querySelector("textarea")?.value || ""
    ]);

    row.eachCell(cell => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };

      cell.alignment = {
        vertical: "middle",
        wrapText: true
      };
    });
  });

  /* =========================
     FOOTER NOTE
  ========================= */
  worksheet.addRow([]);
  worksheet.addRow(["Note 1 :"]);
  worksheet.addRow([
    "In case of Business Debit Card Lost/Stolen, card holder needs to contact HSBC directly at 0800 032 7075"
  ]);

  /* =========================
     DOWNLOAD
  ========================= */
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `ARM_Queries_${selectedAM}.xlsx`);
}
/* =========================
   DATA SUBMISSION REPORT
========================= */

function openDataSubmissionReport() {
  closeAllMenus();
  hideAllPanels();

  document.getElementById("dsReportMonth").value = "";
  document.getElementById("dsReportBody").innerHTML = `
    <tr>
      <td colspan="10" class="text-center text-muted">
        Select a month to view Data Submission report
      </td>
    </tr>
  `;

  document.getElementById("dataSubmissionReport").style.display = "block";
}
function openBudgetVsSpendingReport() {
  hideAllPanels();
  document.getElementById("budgetVsSpendingReport").style.display = "block";
}
async function renderDataSubmissionReport() {
  const month = document.getElementById("dsReportMonth").value;
  const search = document.getElementById("dsReportSearch").value.toLowerCase();
  const filter = document.getElementById("dsReportFilter").value;
  const tbody = document.getElementById("dsReportBody");

  tbody.innerHTML = "";

  if (!month) return;

  const [
    { data: serviceUsers },
    { data: submissions }
  ] = await Promise.all([
    supabase.from("service_users").select("*"),
    supabase.from("data_submissions").select("*").eq("month", month)
  ]);

  const properties = [
    ...new Set(
      (serviceUsers || [])
        .filter(su => su.propertyid)
        .map(su => su.propertyid)
    )
  ];

  let i = 1;

  for (const prid of properties) {
    const su = serviceUsers.find(s => s.propertyid === prid && s.active) || {};
    const record = submissions.find(d => d.prid === prid);

    if (search && !prid.toLowerCase().includes(search)) continue;
    if (filter === "received" && !record?.mfr) continue;
    if (filter === "not_received" && record?.mfr) continue;

    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${i++}</td>
      <td>${prid}</td>
      <td>${su.linemanager || "-"}</td>
      <td>${su.areamanager || "-"}</td>
      <td>${record?.mfr ? "Received" : "Not Received"}</td>
      <td>${record?.house_cash ? "Received" : "Not Received"}</td>
      <td>${record?.safe_log ? "Received" : "Not Received"}</td>
      <td>${record?.house_receipt ? "Received" : "Not Received"}</td>
      <td>${record?.ticket_no || "-"}</td>
      <td>${record?.comments || "-"}</td>
    `;

    tbody.appendChild(row);
  }

  if (!tbody.children.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="text-center text-muted">
          No records found
        </td>
      </tr>
    `;
  }
}
async function renderBudgetVsSpendingReport() {

  const month = document.getElementById("budgetReportMonth").value;
  const tbody = document.getElementById("budgetVsSpendingBody");

  if (!month) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-muted">
          Select month to view report
        </td>
      </tr>`;
    return;
  }

  // 1️⃣ Get service users
  const { data: users, error: userError } = await supabase
    .from("service_users")
    .select("suid, fullName");

  if (userError) {
    console.error(userError);
    return;
  }

  // 2️⃣ Get budgets
 const startOfMonth = month + "-01";
const endOfMonth = month + "-31";

const { data: budgets, error: budgetError } = await supabase
  .from("service_user_budgets")
  .select("suid, total_budget, valid_from, valid_through")
  .lte("valid_from", endOfMonth)
  .gte("valid_through", startOfMonth);

if (budgetError) {
  console.error(budgetError);
  return;
}

  // 3️⃣ Get completed spending
  const { data: spendingData, error: spendingError } = await supabase
    .from("sufp_task_details")
    .select("suid, verified_amount")
    .eq("month", month)
    .eq("status", "COMPLETED");

  if (spendingError) {
    console.error(spendingError);
    return;
  }

  tbody.innerHTML = "";
  let index = 1;

  users.forEach(user => {

    const budgetRecord = budgets
  ?.filter(b => b.suid === user.suid)
  ?.sort((a, b) => new Date(b.valid_from) - new Date(a.valid_from))[0];
    const budget = Number(budgetRecord?.total_budget) || 0;

    const userSpending = spendingData
      ?.filter(s => s.suid === user.suid)
      .reduce((sum, s) => sum + (Number(s.verified_amount) || 0), 0) || 0;

   const isOverspend = userSpending > budget;

const rowClass = isOverspend ? "table-danger" : "table-success";

tbody.innerHTML += `
  <tr class="${rowClass}">
    <td>${index++}</td>
    <td>${user.suid}</td>
    <td>${user.fullName}</td>
    <td>£${budget.toLocaleString()}</td>
    <td>£${userSpending.toLocaleString()}</td>
  </tr>
`;
  });
}
async function exportDataSubmissionExcel() {

  const tbody = document.getElementById("dsReportBody");
  const monthValue = document.getElementById("dsReportMonth")?.value;

  if (!monthValue) {
    alert("Please select a month first");
    return;
  }

  if (!tbody || tbody.children.length === 0) {
    alert("No data to export");
    return;
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Data Submission Report");

  // ===== FORMAT MONTH =====
  function formatMonthToShort(monthStr) {
    const [year, month] = monthStr.split("-");
    const date = new Date(year, month - 1);
    return date.toLocaleString("default", { month: "short" }) + "-" + year.slice(2);
  }

  const formattedMonth = formatMonthToShort(monthValue);

  // ===== TITLE SECTION =====
worksheet.mergeCells("A1:J1");

const titleCell = worksheet.getCell("A1");
titleCell.value = "FLOATS TASK SYSTEM";

titleCell.font = {
  size: 18,
  bold: true,
  color: { argb: "FFFFFFFF" } // white text
};

titleCell.alignment = {
  horizontal: "center",
  vertical: "middle"
};

titleCell.fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF0B3C5D" } // professional navy
};

worksheet.getRow(1).height = 28;

 worksheet.mergeCells("A2:J2");

const subTitleCell = worksheet.getCell("A2");
subTitleCell.value = "Data Submission Report";

subTitleCell.font = {
  size: 14,
  bold: true,
  color: { argb: "FF0B3C5D" } // same navy theme
};

subTitleCell.alignment = {
  horizontal: "center",
  vertical: "middle"
};

worksheet.getRow(2).height = 22;
  worksheet.getCell("A4").value = "Month:";
  worksheet.getCell("A4").font = { bold: true };
  worksheet.getCell("B4").value = formattedMonth;

  worksheet.getCell("H4").value = "Date Exported:";
  worksheet.getCell("H4").font = { bold: true };
  worksheet.getCell("I4").value = new Date().toLocaleDateString();

  worksheet.addRow([]);

  // ===== COLUMN HEADERS =====
  const headerRow = worksheet.addRow([
    "Sr. No",
    "PR ID",
    "Line Manager",
    "Area Manager",
    "MFR",
    "House Cash",
    "Safe Log",
    "House Receipt",
    "Ticket No",
    "Comments"
  ]);

  headerRow.height = 20;

  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F4E78" }
    };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
  });

  worksheet.autoFilter = {
    from: "A6",
    to: "J6"
  };

  worksheet.views = [{ state: "frozen", ySplit: 6 }];

  // ===== TABLE DATA =====
  Array.from(tbody.children).forEach((tr, index) => {

    const td = tr.querySelectorAll("td");
    if (td.length < 10) return;

    const row = worksheet.addRow([
      index + 1,                    // Sr. No
      td[1].innerText.trim(),       // PR ID
      td[2].innerText.trim(),
      td[3].innerText.trim(),
      td[4].innerText.trim(),
      td[5].innerText.trim(),
      td[6].innerText.trim(),
      td[7].innerText.trim(),
      td[8].innerText.trim(),
      td[9].innerText.trim()
    ]);

    row.eachCell((cell, colNumber) => {

      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };

      // Center Sr. No column
      if (colNumber === 1) {
        cell.alignment = { horizontal: "center" };
      }

      // Center PR ID column
      if (colNumber === 2) {
        cell.alignment = { horizontal: "center" };
      }

      // Conditional color for MFR column
      if (colNumber === 5) {
        if (cell.value === "Received") {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFD9EAD3" }
          };
        } else {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF4CCCC" }
          };
        }
      }

    });

  });

  // ===== AUTO WIDTH =====
  worksheet.columns.forEach(column => {
    let maxLength = 12;
    column.eachCell({ includeEmpty: true }, cell => {
      const length = cell.value ? cell.value.toString().length : 10;
      if (length > maxLength) {
        maxLength = length;
      }
    });
    column.width = maxLength + 2;
  });

  // ===== DOWNLOAD =====
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer]),
    `Data_Submission_Report_${formattedMonth}.xlsx`
  );
}
function openOverspendingReport() {
  hideAllPanels();
  document.getElementById("overspendingReport").style.display = "block";
}
async function exportOverspendingReport() {

  const month = document.getElementById("overspendMonth").value;
  if (!month) {
    alert("Select month first.");
    return;
  }

  const dateObj = new Date(month + "-01");
  const formattedMonth = dateObj.toLocaleString("en-GB", {
    month: "short",
    year: "numeric"
  }).replace(" ", "-");

  const today = new Date().toLocaleDateString("en-GB");

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Overspending Report");

  // ===== TITLE =====
  worksheet.mergeCells("A1:G1");
  const titleCell = worksheet.getCell("A1");

  titleCell.value = `Overspending Report – ${formattedMonth}`;
  titleCell.font = {
    size: 18,
    bold: true,
    color: { argb: "FFFFFFFF" }
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F4E78" }
  };

  worksheet.getRow(1).height = 28;

  worksheet.mergeCells("A2:G2");
  const dateCell = worksheet.getCell("A2");
  dateCell.value = `Exported on: ${today}`;
  dateCell.font = { italic: true, size: 11 };
  dateCell.alignment = { horizontal: "right" };

  worksheet.addRow([]);

  // ===== HEADER =====
  const headerRow = worksheet.addRow([
    "Sr. No",
    "SUID",
    "Service User",
    "Total Budget (£)",
    "Total Verified (£)",
    "Difference (£)",
    "Status"
  ]);

  headerRow.height = 22;

  headerRow.eachCell(cell => {
    cell.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF305496" }
    };
    cell.border = {
      top: { style: "medium" },
      left: { style: "medium" },
      bottom: { style: "medium" },
      right: { style: "medium" }
    };
  });

  // ===== COLUMN WIDTHS =====
  worksheet.columns = [
    { width: 14 },
    { width: 20 },
    { width: 38 },
    { width: 24 },
    { width: 26 },
    { width: 24 },
    { width: 20 }
  ];

  // ===== FETCH DATA =====
  const { data: users } = await supabase
    .from("service_users")
    .select("suid, fullName");

  const { data: budgets } = await supabase
    .from("service_user_budgets")
    .select("suid, total_budget");

  const { data: allTasks } = await supabase
    .from("sufp_task_details")
    .select("suid, verified_amount, status")
    .eq("month", month);

  let index = 1;
  let totalBudgetSum = 0;
  let totalSpendingSum = 0;
  let totalDiffSum = 0;

  users.forEach(user => {

    const budgetRecord = budgets?.find(b => b.suid === user.suid);
    const budget = Number(budgetRecord?.total_budget) || 0;

    const userTasks = allTasks?.filter(t => t.suid === user.suid) || [];
    const completedTasks = userTasks.filter(t => t.status === "COMPLETED");

    let verifiedValue;
    let differenceValue = "";
    let status = "Pending";

    if (completedTasks.length === 0) {

      verifiedValue = "Pending";

    } else {

      const totalSpending = completedTasks.reduce(
        (sum, t) => sum + (Number(t.verified_amount) || 0), 0
      );

      differenceValue = budget - totalSpending;
      verifiedValue = totalSpending;

      totalBudgetSum += budget;
      totalSpendingSum += totalSpending;
      totalDiffSum += differenceValue;

      status = totalSpending > budget
        ? "Overspent"
        : "Within Budget";
    }

    const row = worksheet.addRow([
      index++,
      user.suid,
      user.fullName || "",
      budget,
      verifiedValue,
      differenceValue,
      status
    ]);

    row.height = 18;

    row.getCell(1).alignment = { horizontal: "center" };

    row.getCell(4).numFmt = "£#,##0.00";
    row.getCell(4).alignment = { horizontal: "right" };

    if (typeof verifiedValue === "number") {
      row.getCell(5).numFmt = "£#,##0.00";
      row.getCell(6).numFmt = "£#,##0.00";
      row.getCell(5).alignment = { horizontal: "right" };
      row.getCell(6).alignment = { horizontal: "right" };
    } else {
      row.getCell(5).alignment = { horizontal: "right" };
      row.getCell(5).font = { color: { argb: "FFFF8C00" }, bold: true };
    }

    if (status === "Overspent") {
      row.getCell(7).font = { color: { argb: "FFFF0000" }, bold: true };
    } else if (status === "Within Budget") {
      row.getCell(7).font = { color: { argb: "FF008000" }, bold: true };
    } else {
      row.getCell(7).font = { color: { argb: "FFFF8C00" }, bold: true };
    }

    row.eachCell(cell => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
    });

  });

  // ===== GRAND TOTAL ROW =====
  const totalRow = worksheet.addRow([
    "",
    "",
    "Grand Total",
    totalBudgetSum,
    totalSpendingSum,
    totalDiffSum,
    ""
  ]);

  totalRow.font = { bold: true };
  totalRow.height = 20;

  totalRow.getCell(4).numFmt = "£#,##0.00";
  totalRow.getCell(5).numFmt = "£#,##0.00";
  totalRow.getCell(6).numFmt = "£#,##0.00";

  totalRow.eachCell(cell => {
    cell.border = {
      top: { style: "medium" },
      left: { style: "thin" },
      bottom: { style: "medium" },
      right: { style: "thin" }
    };
  });

  worksheet.views = [{ state: "frozen", ySplit: 4 }];

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `Overspending_Report_${formattedMonth}.xlsx`);
}
function openAssignInvoicingForm() {
  hideAllPanels();
  document.getElementById("assignInvoicingForm").style.display = "block";
  loadInvoicingStaffList();
}
async function loadInvoicingStaffList() {

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("role", "Staff");

  if (error) {
    console.error(error);
    return;
  }

  const container = document.getElementById("invoicingStaffList");
  container.innerHTML = "";

 data.forEach(user => {
  container.innerHTML += `
    <div class="form-check">
      <input class="form-check-input"
             type="checkbox"
             name="invoiceStaff"
             value="${user.id}">
      <label class="form-check-label">
        ${user.name}
      </label>
    </div>
  `;
});

  // Load already assigned users
  loadExistingInvoicingUsers();
}
async function loadExistingInvoicingUsers() {

  const { data } = await supabase
    .from("invoicing_responsibility")
    .select("user_id");

  if (!data) return;

  const assignedIds = data.map(r => r.user_id);

  document.querySelectorAll("input[name='invoiceStaff']")
    .forEach(cb => {
      if (assignedIds.includes(cb.value)) {
        cb.checked = true;
      }
    });
}
 async function saveInvoicingAssignment() {

  const selected = document.querySelectorAll(
    "input[name='invoiceStaff']:checked"
  );

  if (selected.length === 0) {
    alert("Select at least one team member");
    return;
  }

  // Delete old configuration
  await supabase
    .from("invoicing_responsibility")
    .delete()
    .neq("id", null);

  const inserts = [];

  selected.forEach(el => {
    inserts.push({
      user_id: el.value,
      assigned_by: window.currentUserId
    });
  });

  await supabase
    .from("invoicing_responsibility")
    .insert(inserts);

  alert("Invoicing responsibility updated");
  restoreDashboard();
}
async function checkInvoicingAccess() {

  const { data } = await supabase
    .from("invoicing_responsibility")
    .select("user_id");

  if (!data) return;

  const allowedIds = data.map(r => r.user_id);

if (allowedIds.includes(window.currentUserId)) {
    document.getElementById("staffInvoicingBtn")
      .classList.remove("d-none");
  } else {
    document.getElementById("staffInvoicingBtn")
      .classList.add("d-none");
  }
}
function openInvoicingPanel() {
  // Close mobile/staff menu if open
const staffMenu = document.getElementById("staffMenuPanel");
if (staffMenu) {
  staffMenu.classList.remove("show");
  staffMenu.style.display = "none";
}

  hideAllPanels();   // 🔥 this is the key

  document.getElementById("invoicingMainPanel").style.display = "block";
}
function openPendingInvoices() {
  hideAllPanels();
  document.getElementById("pendingInvoicesPanel").style.display = "block";
}

function openSentInvoices() {
  alert("Sent Invoices Panel Coming Next");
}
async function loadPendingInvoices(month, category) {

  if (!month) return;

  // 1️⃣ Get completed SUFP for selected month
  const { data: sufpData, error } = await supabase
    .from("sufp_task_details")
    .select("*")
    .eq("month", month)
    .eq("status", "COMPLETED");

  if (error) {
    console.error(error);
    return;
  }

  if (!sufpData || sufpData.length === 0) {
    document.getElementById("pendingInvoicesBody").innerHTML =
      `<tr><td colspan="6" class="text-center">No completed SUFP</td></tr>`;
    return;
  }

  // 2️⃣ Group by SUID and sum verified_amount
  const grouped = {};

  sufpData.forEach(row => {
    if (!grouped[row.suid]) {
      grouped[row.suid] = 0;
    }
    grouped[row.suid] += Number(row.verified_amount || 0);
  });

  const suids = Object.keys(grouped);

  // 3️⃣ Get already invoiced SU for this month
  const { data: invoiceData } = await supabase
    .from("invoices")
    .select("suid")
    .eq("month", month);

  const invoicedSU = invoiceData ? invoiceData.map(i => i.suid) : [];

  // 4️⃣ Filter only those NOT invoiced
  const pendingSU = suids.filter(suid => !invoicedSU.includes(suid));

  if (pendingSU.length === 0) {
    document.getElementById("pendingInvoicesBody").innerHTML =
      `<tr><td colspan="6" class="text-center">No pending invoices</td></tr>`;
    return;
  }

  // 5️⃣ Get service user details
  const { data: suDetails } = await supabase
    .from("service_users")
    .select("*")
    .in("suid", pendingSU);

  const tbody = document.getElementById("pendingInvoicesBody");
  tbody.innerHTML = "";

  let index = 1;

  suDetails.forEach(su => {

    const total = grouped[su.suid] || 0;

   tbody.innerHTML += `
  <tr>
    <td>${index++}</td>
    <td>${su.suid}</td>
    <td>${su.fullName}</td>
    <td>${su.propertyid}</td>
    <td>
      <button class="btn btn-sm btn-primary"
              onclick="openInvoiceDetail('${su.suid}', '${month}')">
        Raise Invoice
      </button>
    </td>
  </tr>
`;
  });
}
function openInvoiceDatabase() {
  hideAllPanels();
  document.getElementById("invoiceDatabasePanel").style.display = "block";
  loadInvoiceDatabase();   // 🔥 THIS LINE WAS MISSING
}
let currentPendingCategory = null;

function openPendingCategory(category) {

  currentPendingCategory = category;

  hideAllPanels();

  document.getElementById("pendingCategoryPanel").style.display = "block";
  document.getElementById("pendingCategoryTitle").innerText = category;
}

function loadPendingInvoicesByCategory() {

  const month = document.getElementById("pendingInvoiceMonth").value;

  if (!month) return;

  loadPendingInvoices(month, currentPendingCategory);
}
async function loadInvoiceDatabase() {

  const tbody = document.getElementById("invoiceDatabaseBody");
  tbody.innerHTML = `
    <tr>
      <td colspan="14" class="text-center text-muted">
        Loading service users...
      </td>
    </tr>
  `;

  try {

    const { data: serviceUsers, error: suError } =
      await supabase.from("service_users")
        .select("*")
        .order("suid", { ascending: true });

    if (suError) throw suError;

    const { data: invoicesData } =
      await supabase.from("invoice_database")
        .select("*");

    tbody.innerHTML = "";

    serviceUsers.forEach((user, index) => {

      const existing =
        invoicesData?.find(inv => inv.suid === user.suid) || {};

      tbody.innerHTML += `
        <tr>
          <td>${index + 1}</td>
          <td>${user.suid}</td>
          <td>${user.fullName || ""}</td>

          <!-- COUNCIL -->
          <td>
            <select class="form-select form-select-sm invoice-field"
                    id="council_${user.suid}"
                    disabled>
              <option value="">Select</option>
              <option value="HCS" ${existing.council === "HCS" ? "selected" : ""}>HCS</option>
              <option value="Kingston" ${existing.council === "Kingston" ? "selected" : ""}>Kingston</option>
              <option value="CCS" ${existing.council === "CCS" ? "selected" : ""}>CCS</option>
            </select>
          </td>

          <td><input class="form-control form-control-sm invoice-field"
              id="type_${user.suid}" value="${existing.type || ""}" readonly></td>

          <td><input class="form-control form-control-sm invoice-field"
              id="account_${user.suid}" value="${existing.account_ref || ""}" readonly></td>

          <td><input class="form-control form-control-sm invoice-field"
              id="nominal_${user.suid}" value="${existing.nominal_ref || ""}" readonly></td>

          <td><input class="form-control form-control-sm invoice-field"
              id="department_${user.suid}" value="${existing.department_code || ""}" readonly></td>

          <td><input class="form-control form-control-sm invoice-field"
              id="reference_${user.suid}" value="${existing.reference || ""}" readonly></td>

          <td>
            <select class="form-select form-select-sm invoice-field"
                    id="status_${user.suid}"
                    disabled>
              <option value="">Select</option>
              <option value="ACTIVE" ${existing.status === "ACTIVE" ? "selected" : ""}>Active</option>
              <option value="INACTIVE" ${existing.status === "INACTIVE" ? "selected" : ""}>Inactive</option>
            </select>
          </td>

          <td>
            <select class="form-select form-select-sm invoice-field"
                    id="send_${user.suid}"
                    disabled>
              <option value="">Select</option>
              <option value="SOA" ${existing.what_to_send === "SOA" ? "selected" : ""}>SOA</option>
              <option value="SOA-Invoice" ${existing.what_to_send === "SOA-Invoice" ? "selected" : ""}>SOA-Invoice</option>
              <option value="SOA-Invoice, Cash log" ${existing.what_to_send === "SOA-Invoice, Cash log" ? "selected" : ""}>SOA-Invoice, Cash log</option>
              <option value="SOA-Invoice, Cash log, Receipts" ${existing.what_to_send === "SOA-Invoice, Cash log, Receipts" ? "selected" : ""}>SOA-Invoice, Cash log, Receipts</option>
            </select>
          </td>

          <td><input class="form-control form-control-sm invoice-field"
              id="email_${user.suid}" value="${existing.email || ""}" readonly></td>

          <td><input class="form-control form-control-sm invoice-field"
              id="cc_${user.suid}" value="${existing.cc || ""}" readonly></td>

          <td><input class="form-control form-control-sm invoice-field"
              id="comments_${user.suid}" value="${existing.comments || ""}" readonly></td>
        </tr>
      `;
    });

  } catch (err) {
    console.error(err);
  }
}
async function saveInvoiceRow(suid) {

  const payload = {
    suid: suid,
    type: document.getElementById(`type_${suid}`).value,
    account_reference: document.getElementById(`acc_${suid}`).value,
    nominal_ac_ref: document.getElementById(`nominal_${suid}`).value,
    department_code: document.getElementById(`dept_${suid}`).value,
    reference: document.getElementById(`ref_${suid}`).value,
    status: document.getElementById(`status_${suid}`).value,
    what_to_send: document.getElementById(`send_${suid}`).value,
    email: document.getElementById(`email_${suid}`).value,
    cc: document.getElementById(`cc_${suid}`).value,
    comments: document.getElementById(`comments_${suid}`).value
  };

  const { error } = await supabase
    .from("invoice_database")
    .upsert([payload], { onConflict: "suid" });

  if (error) {
    alert("Error saving: " + error.message);
  } else {
    alert("Saved successfully");
  }
}
function enableInvoiceEdit() {

  document.querySelectorAll(".invoice-field")
    .forEach(field => {

      if (field.tagName === "SELECT") {
        field.disabled = false;
      } else {
        field.readOnly = false;
      }

    });

  document.getElementById("invoiceEditBtn")
    .classList.add("d-none");

  document.getElementById("invoiceSaveBtn")
    .classList.remove("d-none");
}
async function saveAllInvoices() {

  try {

    const rows = document.querySelectorAll("#invoiceDatabaseBody tr");

    for (let row of rows) {

      const suid = row.children[1]?.innerText.trim();
      if (!suid) continue;

      const data = {
        suid: suid,
        council: document.getElementById(`council_${suid}`)?.value || "",
        type: document.getElementById(`type_${suid}`)?.value || "",
        account_ref: document.getElementById(`account_${suid}`)?.value || "",
        nominal_ref: document.getElementById(`nominal_${suid}`)?.value || "",
        department_code: document.getElementById(`department_${suid}`)?.value || "",
        reference: document.getElementById(`reference_${suid}`)?.value || "",
        status: document.getElementById(`status_${suid}`)?.value || "",
        what_to_send: document.getElementById(`send_${suid}`)?.value || "",
        email: document.getElementById(`email_${suid}`)?.value || "",
        cc: document.getElementById(`cc_${suid}`)?.value || "",
        comments: document.getElementById(`comments_${suid}`)?.value || ""
      };

      await supabase
        .from("invoice_database")
        .upsert(data, { onConflict: "suid" });
    }

    alert("Invoices saved successfully!");

    document.querySelectorAll(".invoice-field").forEach(field => {
      if (field.tagName === "SELECT") field.disabled = true;
      else field.readOnly = true;
    });

  } catch (error) {
    console.error(error);
    alert("Error saving invoices.");
  }
}
function filterInvoiceTable() {

  const suidSearch =
    document.getElementById("invoiceSearchSUID").value.toLowerCase();

  const nameSearch =
    document.getElementById("invoiceSearchName").value.toLowerCase();

  const rows =
    document.querySelectorAll("#invoiceDatabaseBody tr");

  rows.forEach(row => {

    const suid = row.children[1]?.innerText.toLowerCase() || "";
    const name = row.children[2]?.innerText.toLowerCase() || "";

    const matchSUID = suid.includes(suidSearch);
    const matchName = name.includes(nameSearch);

    if (matchSUID && matchName) {
      row.style.display = "";
    } else {
      row.style.display = "none";
    }

  });
}
async function downloadInvoiceTemplate() {

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Invoice Database");

  worksheet.columns = [
    { header: "Serial No", key: "sr", width: 12 },
    { header: "SUID", key: "suid", width: 15 },
    { header: "Council", key: "council", width: 18 },
    { header: "Type", key: "type", width: 18 },
    { header: "Account Ref", key: "account_ref", width: 18 },
    { header: "Nominal Ref", key: "nominal_ref", width: 18 },
    { header: "Department Code", key: "department_code", width: 18 },
    { header: "Reference", key: "reference", width: 18 },
    { header: "Status", key: "status", width: 18 },
    { header: "What to Send", key: "what_to_send", width: 30 },
    { header: "Email", key: "email", width: 25 },
    { header: "CC", key: "cc", width: 25 },
    { header: "Comments", key: "comments", width: 30 }
  ];

  worksheet.getRow(1).eachCell(cell => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F2937" }
    };
  });

  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.autoFilter = { from: "A1", to: "M1" };

  worksheet.addRow({
    sr: 1,
    suid: "SU0001",
    council: "HCS",
    type: "si",
    account_ref: "AR123",
    nominal_ref: "NOM456",
    department_code: "84",
    reference: "REF001",
    status: "ACTIVE",
    what_to_send: "SOA-Invoice",
    email: "example@email.com",
    cc: "cc@email.com",
    comments: "Sample entry"
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });

  saveAs(blob, "Invoice_Database_Template.xlsx");
}
async function bulkUploadInvoices() {

  const fileInput = document.getElementById("invoiceBulkFile");

  if (!fileInput.files.length) {
    alert("Please select an Excel file.");
    return;
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await fileInput.files[0].arrayBuffer());

  const worksheet = workbook.getWorksheet(1);

  if (!worksheet) {
    alert("Invalid Excel file.");
    return;
  }

  const headers = [];
  worksheet.getRow(1).eachCell((cell, col) => {
    headers[col] = cell.value.toLowerCase().replace(/ /g, "_");
  });

  let totalRows = 0;
  let successCount = 0;
  let failCount = 0;
  let failedRows = [];

  const dataToInsert = [];

  worksheet.eachRow((row, rowNumber) => {

    if (rowNumber === 1) return; // skip header

    totalRows++;

    let rowObj = {};

    row.eachCell((cell, col) => {
      rowObj[headers[col]] =
        cell.value ? cell.value.toString().trim() : "";
    });

    if (!rowObj.suid) {
      failCount++;
      failedRows.push(`Row ${rowNumber}: Missing SUID`);
      return;
    }

    dataToInsert.push({
      suid: rowObj.suid,
      council: rowObj.council || "",
      type: rowObj.type || "",
      account_ref: rowObj.account_ref || "",
      nominal_ref: rowObj.nominal_ref || "",
      department_code: rowObj.department_code || "",
      reference: rowObj.reference || "",
      status: rowObj.status || "",
      what_to_send: rowObj.what_to_send || "",
      email: rowObj.email || "",
      cc: rowObj.cc || "",
      comments: rowObj.comments || ""
    });

  });

  if (!dataToInsert.length) {
    alert("No valid rows found.");
    return;
  }

  const { error } = await supabase
    .from("invoice_database")
    .upsert(dataToInsert, { onConflict: "suid" });

  if (error) {
    console.error(error);
    alert("Upload failed. Check console.");
    return;
  }

  successCount = dataToInsert.length;
  failCount = failCount;

  // 🔥 SUMMARY MESSAGE
  let summaryMessage = `
Bulk Upload Summary

Total Rows Processed: ${totalRows}
Successfully Uploaded: ${successCount}
Failed Rows: ${failCount}
`;

  if (failedRows.length) {
    summaryMessage += `

Failed Details:
${failedRows.join("\n")}
`;
  }

  alert(summaryMessage);

  fileInput.value = "";
  loadInvoiceDatabase();
}