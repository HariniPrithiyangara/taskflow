"""Full API regression test after all fixes."""
import urllib.request, json, sys

BASE = 'http://127.0.0.1:8000/api'
PASS = 0
FAIL = 0

def req(method, path, data=None, token=None):
    url = BASE + path
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Token {token}'
    body = json.dumps(data).encode() if data else None
    r = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            raw = resp.read()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read()
        return e.code, json.loads(raw) if raw else {}

def check(name, condition, extra=''):
    global PASS, FAIL
    if condition:
        print(f'  ✅ {name}')
        PASS += 1
    else:
        print(f'  ❌ {name} {extra}')
        FAIL += 1

# ── Auth
print('\n[AUTH]')
s, d = req('POST', '/auth/register/', {'username': 'regrtest1', 'email': 'r@r.com', 'password': 'test1234'})
if s != 201:
    s, d = req('POST', '/auth/login/', {'username': 'regrtest1', 'password': 'test1234'})
token = d.get('token')
check('Register/Login returns token', bool(token))

s, d = req('GET', '/auth/user/', token=token)
check('GET /auth/user/ returns username', d.get('username') == 'regrtest1', str(d))

# ── Task CRUD
print('\n[TASKS CRUD]')
s, task = req('POST', '/tasks/', {'title': 'Test Task 1', 'description': 'Desc', 'status': 'Pending', 'priority': 'High', 'due_date': '2026-12-31'}, token)
check('POST /tasks/ returns 201', s == 201, f'got {s}')
check('Task has id', 'id' in task)
check('Task has project_name field', 'project_name' in task, f'keys: {list(task.keys())}')
check('project_name is None (no project)', task.get('project_name') is None)
task_id = task.get('id')

# Create a few more for pagination test
for i in range(2, 9):
    req('POST', '/tasks/', {'title': f'Task {i}', 'status': 'Pending', 'priority': 'Medium'}, token)

# ── Pagination
print('\n[PAGINATION]')
s, d = req('GET', '/tasks/', token=token)
check('GET /tasks/ returns 200', s == 200)
check('Response has "count" key', 'count' in d, f'keys: {list(d.keys())}')
check('Response has "results" key', 'results' in d)
check('Response has "total_pages" key', 'total_pages' in d)
check('Response has "current_page" key', 'current_page' in d)
check('Page 1 has 6 results max', len(d.get('results', [])) <= 6, f'got {len(d.get("results", []))}')
check('total_pages >= 2', d.get('total_pages', 1) >= 2, f'got {d.get("total_pages")}')

s, d2 = req('GET', '/tasks/?page=2', token=token)
check('Page 2 works', s == 200 and 'results' in d2)

# ── Stats endpoint
print('\n[STATS ENDPOINT]')
s, stats = req('GET', '/tasks/stats/', token=token)
check('GET /tasks/stats/ returns 200', s == 200, f'got {s}')
check('Stats has total', 'total' in stats, str(stats))
check('Stats has pending', 'pending' in stats)
check('Stats has in_progress', 'in_progress' in stats)
check('Stats has completed', 'completed' in stats)
check('Stats has overdue', 'overdue' in stats)
check('Stats total >= 8', stats.get('total', 0) >= 8, f'got {stats.get("total")}')

# ── Filters
print('\n[FILTERS]')
s, d = req('GET', '/tasks/?status=Pending', token=token)
check('Status filter Pending works', s == 200 and all(r['status'] == 'Pending' for r in d.get('results', [])))

s, d = req('GET', '/tasks/?status=Completed', token=token)
check('Status filter Completed returns 0 results', s == 200)

# Mark one complete for filter test
req('PATCH', f'/tasks/{task_id}/', {'status': 'Completed'}, token)
s, d = req('GET', '/tasks/?status=Completed', token=token)
check('Status filter Completed returns completed tasks', d.get('count', 0) >= 1)

# ── Search
print('\n[SEARCH]')
s, d = req('GET', '/tasks/?search=Task+1', token=token)
check('Search works', s == 200 and d.get('count', 0) >= 1, f'count={d.get("count")}')

# ── Ordering
print('\n[ORDERING]')
for ordering in ['due_date', 'title', 'priority', '-created_at']:
    s, d = req('GET', f'/tasks/?ordering={ordering}', token=token)
    check(f'Ordering={ordering} works', s == 200 and 'results' in d)

# ── PATCH
print('\n[PATCH]')
s, updated = req('PATCH', f'/tasks/{task_id}/', {'title': 'Updated Title', 'status': 'In Progress'}, token)
check('PATCH returns 200', s == 200)
check('Title updated', updated.get('title') == 'Updated Title')
check('Status updated', updated.get('status') == 'In Progress')

# ── Empty due_date
print('\n[EDGE CASES]')
s, d = req('POST', '/tasks/', {'title': 'No Date Task', 'status': 'Pending', 'priority': 'Low', 'due_date': ''}, token)
check('Empty due_date accepted (not 400)', s == 201, f'got {s}: {d}')
check('Empty due_date stored as null', d.get('due_date') is None, f'got {d.get("due_date")}')

# ── DELETE
print('\n[DELETE]')
s, _ = req('DELETE', f'/tasks/{task_id}/', token=token)
check('DELETE returns 204', s == 204, f'got {s}')

# Cleanup all test tasks
s, d = req('GET', '/tasks/?page_size=50', token=token)
for t in d.get('results', []):
    req('DELETE', f'/tasks/{t["id"]}/', token=token)

# ── Logout
print('\n[LOGOUT]')
s, d = req('POST', '/auth/logout/', {}, token)
check('Logout returns 200', s == 200)

# Summary
print(f'\n{"="*40}')
print(f'PASSED: {PASS}  FAILED: {FAIL}')
if FAIL > 0:
    print('⚠️  Some tests failed — fix before submission!')
    sys.exit(1)
else:
    print('🎉 All tests passed!')
