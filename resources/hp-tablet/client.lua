local isVisible = false
local dutyState = false

local DISPATCH_MAX = 80
local dispatchFeed = {}

-- Magyar komment: FiveM kliensen az os.* nem megbízható
local function isoNowUtc()
  local y = GetClockYear()
  local mo = GetClockMonth()
  local d = GetClockDayOfMonth()
  local h = GetClockHours()
  local mi = GetClockMinutes()
  local s = 0
  return string.format("%04d-%02d-%02dT%02d:%02d:%02dZ", y, mo, d, h, mi, s)
end

local function makeId()
  return tostring(GetGameTimer()) .. "-" .. tostring(math.random(1000, 9999))
end

local function getStreetAndZoneFromCoords(coords)
  if not coords or coords.x == nil then return "Ismeretlen hely" end
  local streetHash, crossingHash = GetStreetNameAtCoord(coords.x + 0.0, coords.y + 0.0, coords.z + 0.0)
  local street = GetStreetNameFromHashKey(streetHash)
  local zone = GetLabelText(GetNameOfZone(coords.x + 0.0, coords.y + 0.0, coords.z + 0.0))
  if street and zone and street ~= "" and zone ~= "" then
    return street .. ", " .. zone
  end
  return street or zone or "Ismeretlen hely"
end

local function normalizeDispatchPayload(payload)
  payload = payload or {}

  local code = payload.dispatchCode or payload.code or payload.callCode or payload.alertCode or "10-00"
  local title = payload.dispatchMessage or payload.title or payload.message or payload.alert or "Riasztás"

  local origin = nil
  if payload.origin and payload.origin.x then
    origin = { x = payload.origin.x + 0.0, y = payload.origin.y + 0.0, z = (payload.origin.z or 0.0) + 0.0 }
  elseif payload.coords and payload.coords.x then
    origin = { x = payload.coords.x + 0.0, y = payload.coords.y + 0.0, z = (payload.coords.z or 0.0) + 0.0 }
  end

  local location = payload.firstStreet or payload.location or payload.street or payload.area or nil
  if not location then
    if origin then
      location = getStreetAndZoneFromCoords(origin)
    else
      location = "Ismeretlen hely"
    end
  end

  return {
    id = makeId(),
    code = tostring(code),
    title = tostring(title),
    location = tostring(location),
    ts = isoNowUtc(),
    origin = origin,
  }
end

local function pushDispatch(payload)
  local item = normalizeDispatchPayload(payload)

  table.insert(dispatchFeed, 1, item)
  if #dispatchFeed > DISPATCH_MAX then
    dispatchFeed[DISPATCH_MAX + 1] = nil
  end

  SendNUIMessage({
    type = "hpx:notify",
    title = item.code .. " • " .. item.title,
    message = item.location,
    level = "info"
  })
end

exports("PushDispatch", function(payload) pushDispatch(payload) end)
AddEventHandler("hp-tablet:pushDispatch", function(payload) pushDispatch(payload) end)

-- ===== HPX player context =====
local function guessRoleFromJob(jobName)
  if type(jobName) ~= "string" then return "civ" end
  local j = string.lower(jobName)
  if j == "police" or j == "pd" or j == "sheriff" or string.find(j, "police", 1, true) then return "police" end
  if j == "ems" or j == "ambulance" or string.find(j, "ems", 1, true) then return "ems" end
  return "civ"
end

local function tryGetHpBasePlayerData()
  if GetResourceState("hp-base") ~= "started" then return nil end
  local ok, data = pcall(function()
    return exports["hp-base"]:GetPlayerData()
  end)
  if ok and type(data) == "table" then return data end
  return nil
end

local function tryIsPed(key)
  if GetResourceState("isPed") ~= "started" then return nil end
  local ok, v = pcall(function()
    return exports["isPed"]:isPed(key)
  end)
  if ok then return v end
  return nil
end

local function tryGetCallsign()
  if GetResourceState("hp-police") ~= "started" then return nil end
  local ok, cs = pcall(function()
    return exports["hp-police"]:GetCallsign()
  end)
  if ok then return cs end
  return nil
end

local function extractCharacterName(baseData)
  local full = tryIsPed("fullname")
  if type(full) == "string" and full ~= "" then return full end

  local fn = tryIsPed("firstname")
  local ln = tryIsPed("lastname")
  if type(fn) == "string" and type(ln) == "string" and fn ~= "" and ln ~= "" then
    return fn .. " " .. ln
  end

  if type(baseData) == "table" then
    local name = baseData.characterName or baseData.charName or baseData.fullname or baseData.name
    if type(name) == "string" and name ~= "" then return name end
  end

  return GetPlayerName(PlayerId())
end

local function extractJob(baseData)
  local jobLabel = "Civil"
  local jobName = "civ"
  local jobGrade = 0

  if type(baseData) == "table" then
    local job = baseData.job or baseData.Job
    if type(job) == "table" then
      jobName = job.name or job.Name or job.id or jobName
      jobLabel = job.label or job.Label or job.name or jobLabel
      jobGrade = job.grade or job.Grade or job.level or jobGrade
    elseif type(job) == "string" then
      jobName = job
      jobLabel = job
    end
  end

  local pedJob = tryIsPed("job") or tryIsPed("myjob") or tryIsPed("jobName")
  if type(pedJob) == "string" and pedJob ~= "" then
    jobName = pedJob
    if jobLabel == "Civil" then jobLabel = pedJob end
  end

  local role = guessRoleFromJob(jobName)
  return jobLabel, jobName, jobGrade, role
end

-- ===== Visibility / close =====
local function setVisible(visible)
  isVisible = visible and true or false
  SetNuiFocus(isVisible, isVisible)
  SendNUIMessage({ type = "hpx:tablet:visible", visible = isVisible })
end

RegisterCommand("tablet", function()
  setVisible(not isVisible)
end, false)

RegisterKeyMapping("tablet", "HPX Tablet megnyitása", "keyboard", "F1")

-- =========================================================
-- NUI RPC CALLBACKOK (ha bármelyik hiányzik -> 404)
-- =========================================================
RegisterNUICallback("tablet:getGameTime", function(_data, cb)
  cb({ ok = true, hours = GetClockHours(), minutes = GetClockMinutes(), transport = "nui" })
end)

RegisterNUICallback("tablet:getPlayerContext", function(_data, cb)
  local serverId = GetPlayerServerId(PlayerId())
  local baseData = tryGetHpBasePlayerData()

  local charName = extractCharacterName(baseData)
  local jobLabel, jobName, jobGrade, role = extractJob(baseData)
  local callsign = tryGetCallsign()

  cb({
    ok = true,
    context = {
      serverId = serverId,
      name = charName,
      role = role,
      jobLabel = jobLabel,
      jobName = jobName,
      jobGrade = jobGrade,
      callsign = callsign,
      duty = dutyState,
      transport = "nui"
    }
  })
end)

RegisterNUICallback("tablet:setDuty", function(data, cb)
  dutyState = (data and data.duty) and true or false
  cb({ ok = true, duty = dutyState })
end)

RegisterNUICallback("mdt:getDispatchFeed", function(data, cb)
  local limit = (data and data.limit) or 80
  cb({ ok = true, items = dispatchFeed, transport = "nui" })
end)

RegisterNUICallback("mdt:testDispatch", function(data, cb)
  local p = GetEntityCoords(PlayerPedId())
  pushDispatch({
    dispatchCode = (data and data.code) or "10-38",
    dispatchMessage = (data and data.title) or "Teszt riasztás (tablet)",
    location = (data and data.location) or nil,
    origin = { x = p.x, y = p.y, z = p.z }
  })
  cb({ ok = true })
end)

RegisterNUICallback("mdt:setWaypoint", function(data, cb)
  if data and data.x and data.y then
    SetNewWaypoint(data.x + 0.0, data.y + 0.0)
  end
  cb({ ok = true })
end)

RegisterNUICallback("tablet:close", function(_data, cb)
  setVisible(false)
  cb({ ok = true })
end)

CreateThread(function()
  Wait(200)
  setVisible(false)
end)
