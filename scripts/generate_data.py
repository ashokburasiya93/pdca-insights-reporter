"""Generate the SYNTHETIC PDCA dataset. All names, numbers and events are made up."""
import json, random, datetime as dt, math
random.seed(42)
AS_OF = dt.date(2026, 11, 2)
D = lambda s: dt.date.fromisoformat(s)
LINES = ["Line 1", "Line 2", "Line 3", "Line 4"]
AREAS = {"Line 1": "Body welding", "Line 2": "Stamping", "Line 3": "Paint shop", "Line 4": "Final assembly"}
PEOPLE = ["Rajesh Kumar", "Priya Nair", "Suresh Patel", "Meena Iyer", "Arjun Rao", "Kavita Shah", "Vikram Singh",
          "Neha Joshi", "Rahul Desai", "Anita Menon", "Deepak Verma", "Sunita Reddy"]
KPIS = ["oee", "scrap_pct", "downtime_min", "fpy"]
KPI_NAME = {"oee": "OEE %", "scrap_pct": "Scrap %", "downtime_min": "Downtime minutes per shift", "fpy": "First-pass yield %"}
BASE = {"Line 1": dict(oee=72, scrap_pct=3.2, downtime_min=46, fpy=93.5), "Line 2": dict(oee=70, scrap_pct=4.1, downtime_min=52, fpy=92.0),
        "Line 3": dict(oee=68, scrap_pct=3.6, downtime_min=40, fpy=90.5), "Line 4": dict(oee=75, scrap_pct=2.4, downtime_min=35, fpy=95.0)}
HIGHER_BETTER = {"oee": True, "scrap_pct": False, "downtime_min": False, "fpy": True}

# ---- problem templates (title, kpi, root cause, countermeasure, lesson words)
P = [
 ("Weld porosity on side frame", "Line 1", "scrap_pct", "Contaminated wire feed and worn contact tips", "Changed tip replacement to every 400 welds and added wire liner cleaning", "porosity pinholes weld spatter contact tip wire feed"),
 ("Robot weld gun cap wear causing rework", "Line 1", "fpy", "Cap dresser cycle too long", "Reduced cap dressing interval and added wear check", "weld cap dresser electrode wear rework"),
 ("Fixture misalignment on door panel press", "Line 2", "scrap_pct", "Locating pins worn on fixture F-12", "Replaced locating pins and introduced poka-yoke fixture check", "fixture locating pin misalignment burr press"),
 ("Die change taking too long", "Line 2", "downtime_min", "No pre-staging of dies, tools searched during changeover", "SMED: pre-staged dies and standard changeover cart", "changeover die SMED setup time"),
 ("Paint runs and sags on roof", "Line 3", "fpy", "Booth humidity swings and gun distance drift", "Humidity control and gun distance gauge", "paint run sag humidity booth spray gun"),
 ("Dust inclusions in paint", "Line 3", "scrap_pct", "Filter change interval too long", "Filter replacement every 2 weeks and tack-rag standard", "dust inclusion dirt paint filter"),
 ("Conveyor stoppages at final assembly", "Line 4", "downtime_min", "Sensor misreads at transfer station", "Relocated sensor and added cleaning to TPM checklist", "conveyor stop sensor transfer jam"),
 ("Torque errors on wheel nuts", "Line 4", "fpy", "Nutrunner calibration drift", "Weekly calibration and torque audit", "torque nutrunner calibration fastener"),
 ("Spot weld splash on roof rail", "Line 1", "scrap_pct", "Current too high after tip dressing", "Adjusted weld schedule stepper", "weld splash expulsion current"),
 ("Stamping cracks on wheel arch", "Line 2", "scrap_pct", "Lubrication uneven on blank", "Automatic blank lubrication", "crack split stamping lubrication blank"),
 ("Low OEE on paint line night shift", "Line 3", "oee", "Late start-up and minor stops", "Start-up checklist and minor stop board", "oee night shift startup minor stops"),
 ("Hose clamp missing at engine dress", "Line 4", "fpy", "Parts presentation confusing", "Kitting with shadow tray", "missing part clamp kitting error proofing"),
 ("Hydraulic leak on press 3", "Line 2", "downtime_min", "Seal wear not covered in PM", "Added seal inspection to preventive maintenance", "hydraulic leak seal press maintenance"),
 ("Overspray on masking", "Line 3", "fpy", "Masking tape quality", "Changed tape supplier spec", "overspray masking tape"),
 ("Weld nut missing on cross member", "Line 1", "fpy", "Feeder jams", "Feeder bowl adjustment and sensor", "weld nut feeder missing"),
]
cycles, actions, lessons = [], [], []
cid = 0
def new_id():
    global cid; cid += 1; return f"PDCA-{cid:03d}"

# ---- 30 closed cycles (history), each with a lesson; 9 closed without KPI verification
closed_start = D("2025-06-01")
for i in range(30):
    t = P[i % len(P)]
    start = closed_start + dt.timedelta(days=i * 12)
    close = start + dt.timedelta(days=random.randint(45, 90))
    verified = i not in {2, 5, 8, 11, 14, 17, 20, 23, 26}
    c = dict(id=new_id(), title=t[0] + ("" if i < 15 else " (repeat)"), line=t[1], area=AREAS[t[1]], kpi=t[2],
             problem=f"{t[0]} on {t[1]}", root_cause=t[3], countermeasure=t[4], owner=random.choice(PEOPLE),
             status="Closed", stage="Act", start_date=str(start), stage_entered=str(close), due_date=str(close),
             closed_date=str(close), countermeasure_date=None, baseline=None, target=None,
             kpi_verified=verified, duplicate_of=None)
    cycles.append(c)
    lessons.append(dict(id=f"LL-{i+1:03d}", cycle_id=c["id"], line=t[1], root_cause=t[3], countermeasure=t[4],
        result=("Verified: KPI reached target within 6 weeks." if verified else "Not verified: closed on judgement, no KPI evidence recorded."),
        notes=f"{t[0]}. Root cause: {t[3].lower()}. What worked: {t[4].lower()}. Keywords: {t[5]}."))

# ---- 38 open cycles
open_defs = []
# PDCA-017-like demo will be assigned explicitly below
stages_plan = ["Check"] * 15 + ["Do"] * 13 + ["Plan"] * 7 + ["Act"] * 3   # 38
random.shuffle(stages_plan)
open_start_id = cid
for k in range(38):
    t = P[(k * 7 + 3) % len(P)]
    open_defs.append(t)
for k, t in enumerate(open_defs):
    stage = stages_plan[k]
    start = D("2026-06-15") + dt.timedelta(days=k * 3)
    c = dict(id=new_id(), title=t[0], line=t[1], area=AREAS[t[1]], kpi=t[2], problem=f"{t[0]} on {t[1]}",
             root_cause=t[3] if stage != "Plan" else None, countermeasure=t[4] if stage in ("Do", "Check", "Act") else None,
             owner=random.choice(PEOPLE), status="Open", stage=stage, start_date=str(start),
             stage_entered=None, due_date=str(start + dt.timedelta(days=90)), closed_date=None,
             countermeasure_date=None, baseline=None, target=None, kpi_verified=None, duplicate_of=None)
    cycles.append(c)
open_cycles = [c for c in cycles if c["status"] == "Open"]

# Make PDCA-047 the showcase (renamed id below to keep logic simple): use the open cycle on Line 2 scrap
# Assign stage_entered so exactly 11 open cycles are in Check > 14 days
check = [c for c in open_cycles if c["stage"] == "Check"]
for j, c in enumerate(check):
    days = [21, 35, 18, 42, 16, 28, 55, 19, 24, 31, 15][j] if j < 11 else [5, 9, 12, 3][j - 11]
    c["stage_entered"] = str(AS_OF - dt.timedelta(days=days))
for c in open_cycles:
    if c["stage_entered"] is None:
        c["stage_entered"] = str(AS_OF - dt.timedelta(days=random.randint(2, 13)))
# countermeasure dates for Do(late)/Check/Act cycles
for c in open_cycles:
    if c["stage"] in ("Check", "Act"):
        c["countermeasure_date"] = str(D(c["stage_entered"]) - dt.timedelta(days=random.randint(3, 10)))

# baselines/targets
def mean_base(line, kpi): return BASE[line][kpi]
for c in cycles:
    b = mean_base(c["line"], c["kpi"])
    if HIGHER_BETTER[c["kpi"]]: tgt = round(b + (5 if c["kpi"] == "oee" else 2.5), 1)
    else: tgt = round(b * 0.7, 1)
    c["baseline"], c["target"] = round(b, 1), tgt
# data imperfections: 2 open cycles with no owner, 2 with no baseline/target
open_cycles[4]["owner"] = None; open_cycles[19]["owner"] = None
open_cycles[9]["baseline"] = None; open_cycles[9]["target"] = None
open_cycles[27]["target"] = None
# duplicate: open_cycles[30] duplicates open_cycles[12]
dup, orig = open_cycles[30], open_cycles[12]
for f in ("title", "line", "area", "kpi", "problem"): dup[f] = orig[f]
dup["duplicate_of"] = orig["id"]
# 3 recurring defects: open cycles whose title matches a closed lesson exactly -> already set by template reuse.

# ---- showcase cycle: rename the first open Check cycle on Line 2 into PDCA-017 slot? keep ids stable instead:
show = next(c for c in check[:11] if True)
show.update(title="Door panel scrap after fixture change", line="Line 2", area=AREAS["Line 2"], kpi="scrap_pct",
            problem="Scrap on door inner panel at press 2 is 4.1% against a 2.5% target",
            root_cause="Locating pins worn on fixture F-12", countermeasure="Replaced locating pins and added a poka-yoke fixture check",
            baseline=4.1, target=2.5, countermeasure_date="2026-09-15", stage_entered="2026-10-06", owner="Priya Nair")
# swap ids so showcase is PDCA-017 is impossible (closed ids 1-30), so rename showcase id to PDCA-047 and record
SHOW_ID = show["id"]

# ---- actions: 140 total, 27 overdue (due < AS_OF, status not Done, due not null), 4 with no due date, 5 no owner
acts = []
aid = 0
open_ids = [c["id"] for c in open_cycles]
verbs = ["Replace", "Audit", "Train operators on", "Update standard work for", "Install", "Calibrate", "Inspect", "Trial", "Measure", "Review"]
objs = ["locating pins", "contact tips", "booth humidity control", "sensor bracket", "nutrunner", "changeover cart", "filters", "lubrication system", "kitting tray", "weld schedule"]
plan = (["overdue"] * 27) + (["nodue"] * 4) + (["done"] * 55) + (["future"] * 54)  # 140
random.shuffle(plan)
for k, kind in enumerate(plan):
    aid += 1
    c = random.choice(open_cycles)
    if kind == "overdue":
        due = AS_OF - dt.timedelta(days=random.randint(1, 40)); status = random.choice(["Open", "In progress"]); done = None
    elif kind == "nodue":
        due = None; status = "Open"; done = None
    elif kind == "done":
        due = AS_OF - dt.timedelta(days=random.randint(1, 60)); status = "Done"; done = str(due - dt.timedelta(days=random.randint(0, 5)))
    else:
        due = AS_OF + dt.timedelta(days=random.randint(1, 45)); status = random.choice(["Open", "In progress"]); done = None
    acts.append(dict(id=f"ACT-{aid:03d}", cycle_id=c["id"], line=c["line"], action=f"{random.choice(verbs)} {random.choice(objs)}",
                     owner=random.choice(PEOPLE), due_date=(str(due) if due else None), status=status, completed_date=done))
no_owner = [a for a in acts if a["status"] != "Done"][:5]
for a in no_owner: a["owner"] = None
# showcase actions
for a in acts:
    if a["cycle_id"] == SHOW_ID and a["status"] != "Done" and a["due_date"] and D(a["due_date"]) < AS_OF:
        pass

# ---- KPI readings daily per line+shift, 2026-05-01 .. 2026-11-01
readings = []
start, end = D("2026-05-01"), D("2026-11-01")
effects = []  # (line,kpi,date,factor)
used = set()
for c in sorted(open_cycles, key=lambda c: (c["id"] != SHOW_ID, c["countermeasure_date"] or "")):
    if c["countermeasure_date"]:
        cmd = D(c["countermeasure_date"])
        b = BASE[c["line"]][c["kpi"]]
        if (c["line"], c["kpi"]) in used: continue   # only the first countermeasure on a line+KPI moves it
        used.add((c["line"], c["kpi"]))
        if c["id"] == SHOW_ID: delta = 2.6 - 4.1
        else:
            r = random.random()
            if HIGHER_BETTER[c["kpi"]]: delta = (3.0 if r > 0.4 else 0.2)
            else: delta = -(b * 0.25 if r > 0.4 else b * 0.02)
        effects.append((c["line"], c["kpi"], cmd, delta))
day = start
while day <= end:
    for line in LINES:
        for shift in ("A", "B"):
            row = dict(date=str(day), line=line, shift=shift)
            # missing data: Line 3 night shift readings missing for 10 days in August
            if line == "Line 3" and shift == "B" and D("2026-08-10") <= day <= D("2026-08-19"):
                continue
            for k in KPIS:
                v = BASE[line][k]
                for (l, kk, cmd, delta) in effects:
                    if l == line and kk == k and day >= cmd:
                        v += delta
                noise = {"oee": 2.0, "scrap_pct": 0.25, "downtime_min": 6, "fpy": 0.8}[k]
                if shift == "B": v += {"oee": -1.5, "scrap_pct": 0.15, "downtime_min": 4, "fpy": -0.4}[k]
                v = v + random.gauss(0, noise)
                row[k] = round(max(v, 0), 2)
            readings.append(row)
    day += dt.timedelta(days=1)

people = [dict(name=p, role=r) for p, r in zip(PEOPLE, ["Production Manager", "Quality Engineer", "Line Supervisor", "Quality Engineer",
          "Line Supervisor", "Maintenance Engineer", "Line Supervisor", "Process Engineer", "Line Supervisor", "Quality Engineer", "Maintenance Engineer", "Process Engineer"])]
# ---- renumber: open cycles PDCA-001..038, closed PDCA-039..068; showcase becomes PDCA-017
order = [c for c in cycles if c["status"] == "Open"] + [c for c in cycles if c["status"] == "Closed"]
idmap = {c["id"]: f"PDCA-{i+1:03d}" for i, c in enumerate(order)}
s17 = idmap[SHOW_ID]; other = next(k for k, v in idmap.items() if v == "PDCA-017")
idmap[other], idmap[SHOW_ID] = s17, "PDCA-017"
for c in cycles:
    c["id"] = idmap[c["id"]]
    if c["duplicate_of"]: c["duplicate_of"] = idmap[c["duplicate_of"]]
for a in acts: a["cycle_id"] = idmap[a["cycle_id"]]
for l in lessons: l["cycle_id"] = idmap[l["cycle_id"]]
cycles.sort(key=lambda c: c["id"])
SHOW_ID = "PDCA-017"
meta = dict(as_of=str(AS_OF), synthetic=True, note="SYNTHETIC DATA made up for a course project. Not real plant data.",
            plant="Assembly Plant (synthetic)", lines=LINES, shifts=["A (day)", "B (night)"], kpis=KPI_NAME,
            higher_is_better=HIGHER_BETTER, stuck_threshold_days=14, min_days_for_effect=7, showcase_cycle=SHOW_ID, people=people)
json.dump(dict(meta=meta, cycles=cycles, actions=acts, lessons=lessons), open("data/pdca.json", "w"), indent=0)
json.dump(readings, open("data/kpi_readings.json", "w"), separators=(",", ":"))
# summary
oc = [c for c in cycles if c["status"] == "Open"]
stuck = [c for c in oc if c["stage"] == "Check" and (AS_OF - D(c["stage_entered"])).days > 14]
od = [a for a in acts if a["status"] != "Done" and a["due_date"] and D(a["due_date"]) < AS_OF]
print("open", len(oc), "closed", len(cycles) - len(oc), "stuck_check>14", len(stuck), "actions", len(acts), "overdue", len(od),
      "closed_unverified", sum(1 for c in cycles if c["status"] == "Closed" and not c["kpi_verified"]), "readings", len(readings), "showcase", SHOW_ID)
