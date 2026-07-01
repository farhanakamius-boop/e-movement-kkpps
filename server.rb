#!/usr/bin/env ruby
# -*- coding: utf-8 -*-

require 'webrick'
require 'json'
require 'csv'
require 'socket'
require 'time'

PORT = 3000
CSV_PATH = 'STAF KKPPS .csv'
DB_PATH = 'database.json'

ADMIN_USER = "admin"
ADMIN_PASS = "admin123"
ADMIN_TOKEN = "admin_secure_token_kkpps_2026"

# --- Database Seeder & Helpers ---
def seed_db
  return if File.exist?(DB_PATH)

  lecturers = []
  unless File.exist?(CSV_PATH)
    puts "Amaran: Fail CSV tidak dijumpai di #{CSV_PATH}. Pangkalan data kosong dicipta."
    File.write(DB_PATH, JSON.pretty_generate([]))
    return
  end

  begin
    # Read the CSV with UTF-8 encoding, handling BOM and invalid characters
    content = File.read(CSV_PATH, encoding: 'bom|utf-8:utf-8', invalid: :replace, undef: :replace, replace: '')
    CSV.parse(content) do |row|
      next if row.nil? || row.length < 6
      id_str = row[0].to_s.strip
      next unless id_str =~ /\A\d+\z/

      name = row[2].to_s.strip
      role = row[3].to_s.strip.gsub(/\s+/, ' ')
      phone = row[4].to_s.strip
      ic = row[5].to_s.strip

      next if name.empty?

      lecturers << {
        id: id_str.to_i,
        name: name,
        role: role.empty? ? "Pensyarah / Kakitangan" : role,
        phone: phone,
        ic: ic,
        status: "Dalam Kampus",
        destination: "",
        waktu_keluar: "",
        waktu_kembali: "",
        updated_at: ""
      }
    end

    File.write(DB_PATH, JSON.pretty_generate(lecturers))
    puts "Pangkalan data berjaya disemai dengan #{lecturers.length} orang staf."
  rescue => e
    puts "Ralat membaca/menulis database: #{e.message}"
  end
end

def load_db
  seed_db unless File.exist?(DB_PATH)
  begin
    JSON.parse(File.read(DB_PATH))
  rescue
    []
  end
end

def save_db(data)
  begin
    File.write(DB_PATH, JSON.pretty_generate(data))
  rescue => e
    puts "Ralat menyimpan database: #{e.message}"
  end
end

# --- Get network IP address ---
def get_local_ip
  begin
    # Connects to non-routable IP to obtain local network interface socket name
    socket = UDPSocket.new
    socket.connect('10.254.254.254', 1)
    ip = socket.addr[3]
    socket.close
    ip
  rescue
    '127.0.0.1'
  end
end

# --- APIServlet Base Class ---
class APIServlet < WEBrick::HTTPServlet::AbstractServlet
  def do_OPTIONS(request, response)
    response.status = 204
    response['Access-Control-Allow-Origin'] = '*'
    response['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
  end

  def set_json_response(response, data, status = 200)
    response.status = status
    response['Content-Type'] = 'application/json; charset=utf-8'
    response['Access-Control-Allow-Origin'] = '*'
    response.body = JSON.generate(data)
  end
end

# GET /api/lecturers
class LecturersServlet < APIServlet
  def do_GET(request, response)
    db = load_db
    # Strip IC numbers for security
    public_db = db.map do |item|
      item.reject { |k, _| k == 'ic' }
    end
    set_json_response(response, public_db)
  end

  def do_OPTIONS(request, response)
    super
  end
end

# POST /api/login
class LoginServlet < APIServlet
  def do_POST(request, response)
    begin
      body = JSON.parse(request.body)
    rescue
      return set_json_response(response, { success: false, message: 'Format data JSON tidak sah' }, 400)
    end

    lecturer_id = body['id']
    ic_number = body['ic'].to_s.strip

    if lecturer_id.nil? || ic_number.empty?
      return set_json_response(response, { success: false, message: 'Nama Pensyarah dan No. IC diperlukan' }, 400)
    end

    db = load_db
    found = db.find do |item|
      if item['id'] == lecturer_id.to_i
        clean_db_ic = item['ic'].to_s.gsub(/[-\s]/, '').strip
        clean_input_ic = ic_number.gsub(/[-\s]/, '').strip
        clean_db_ic == clean_input_ic
      else
        false
      end
    end

    if found
      lecturer_info = found.reject { |k, _| k == 'ic' }
      set_json_response(response, {
        success: true,
        token: found['ic'],
        lecturer: lecturer_info
      })
    else
      set_json_response(response, { success: false, message: 'No. IC tidak sepadan dengan rekod pensyarah' }, 401)
    end
  end

  def do_OPTIONS(request, response)
    super
  end
end

# POST /api/status
class StatusServlet < APIServlet
  def do_POST(request, response)
    begin
      body = JSON.parse(request.body)
    rescue
      return set_json_response(response, { success: false, message: 'Format data JSON tidak sah' }, 400)
    end

    lecturer_id = body['id']
    token = body['token'].to_s.strip
    status = body['status'].to_s.strip
    destination = body['destination'].to_s.strip
    waktu_keluar = body['waktu_keluar'].to_s.strip
    waktu_kembali = body['waktu_kembali'].to_s.strip

    if lecturer_id.nil? || token.empty?
      return set_json_response(response, { success: false, message: 'Sesi tidak sah atau tiada kebenaran' }, 400)
    end

    db = load_db
    found_idx = db.find_index do |item|
      if item['id'] == lecturer_id.to_i
        clean_db_ic = item['ic'].to_s.gsub(/[-\s]/, '').strip
        clean_token = token.gsub(/[-\s]/, '').strip
        clean_db_ic == clean_token
      else
        false
      end
    end

    if found_idx
      unless ['Dalam Kampus', 'Keluar'].include?(status)
        return set_json_response(response, { success: false, message: 'Status tidak sah' }, 400)
      end

      # Perform update
      db[found_idx]['status'] = status
      if status == 'Keluar'
        db[found_idx]['destination'] = destination
        db[found_idx]['waktu_keluar'] = waktu_keluar
        db[found_idx]['waktu_kembali'] = waktu_kembali
      else
        db[found_idx]['destination'] = ''
        db[found_idx]['waktu_keluar'] = ''
        db[found_idx]['waktu_kembali'] = ''
      end

      # Local timestamp
      db[found_idx]['updated_at'] = Time.now.strftime('%d-%m-%Y %I:%M %p')

      save_db(db)
      set_json_response(response, { success: true, message: 'Status berjaya disimpan!' })
    else
      set_json_response(response, { success: false, message: 'Token tidak sah atau tiada kebenaran mengemaskini' }, 401)
    end
  end

  def do_OPTIONS(request, response)
    super
  end
end

# POST /api/admin/login
class AdminLoginServlet < APIServlet
  def do_POST(request, response)
    begin
      body = JSON.parse(request.body)
    rescue
      return set_json_response(response, { success: false, message: 'Format data JSON tidak sah' }, 400)
    end

    username = body['username'].to_s.strip
    password = body['password'].to_s.strip

    if username == ADMIN_USER && password == ADMIN_PASS
      set_json_response(response, { success: true, token: ADMIN_TOKEN })
    else
      set_json_response(response, { success: false, message: 'Nama pengguna atau kata laluan salah' }, 401)
    end
  end

  def do_OPTIONS(request, response)
    super
  end
end

# GET /api/admin/lecturers
class AdminLecturersServlet < APIServlet
  def do_GET(request, response)
    token = request.query['token'] || (request['Authorization'] || '').gsub('Bearer ', '').strip
    
    if token == ADMIN_TOKEN
      db = load_db
      set_json_response(response, db)
    else
      set_json_response(response, { success: false, message: 'Tiada kebenaran (Unauthorized)' }, 401)
    end
  end

  def do_OPTIONS(request, response)
    super
  end
end

# POST /api/admin/*
class AdminServlet < APIServlet
  def do_POST(request, response)
    begin
      body = JSON.parse(request.body)
    rescue
      return set_json_response(response, { success: false, message: 'Format data JSON tidak sah' }, 400)
    end

    token = body['token'].to_s.strip
    if token != ADMIN_TOKEN
      return set_json_response(response, { success: false, message: 'Tiada kebenaran (Unauthorized)' }, 401)
    end

    path = request.path
    db = load_db

    case path
    when '/api/admin/add_lecturer'
      name = body['name'].to_s.strip
      role = body['role'].to_s.strip.gsub(/\s+/, ' ')
      phone = body['phone'].to_s.strip
      ic = body['ic'].to_s.strip

      if name.empty? || ic.empty?
        return set_json_response(response, { success: false, message: 'Nama dan No. IC diperlukan' }, 400)
      end

      # Generate next ID
      next_id = db.map { |l| l['id'] || 0 }.max.to_i + 1

      new_lecturer = {
        id: next_id,
        name: name,
        role: role.empty? ? "Pensyarah / Kakitangan" : role,
        phone: phone,
        ic: ic,
        status: "Dalam Kampus",
        destination: "",
        waktu_keluar: "",
        waktu_kembali: "",
        updated_at: Time.now.strftime('%d-%m-%Y %I:%M %p')
      }

      db << new_lecturer
      save_db(db)
      set_json_response(response, { success: true, message: 'Pensyarah berjaya ditambah!', lecturer: new_lecturer })

    when '/api/admin/update_lecturer'
      id = body['id']
      name = body['name'].to_s.strip
      role = body['role'].to_s.strip.gsub(/\s+/, ' ')
      phone = body['phone'].to_s.strip
      ic = body['ic'].to_s.strip

      if id.nil? || name.empty? || ic.empty?
        return set_json_response(response, { success: false, message: 'ID, Nama, dan No. IC diperlukan' }, 400)
      end

      idx = db.find_index { |l| l['id'] == id.to_i }
      if idx.nil?
        return set_json_response(response, { success: false, message: 'Pensyarah tidak dijumpai' }, 404)
      end

      db[idx]['name'] = name
      db[idx]['role'] = role.empty? ? "Pensyarah / Kakitangan" : role
      db[idx]['phone'] = phone
      db[idx]['ic'] = ic
      db[idx]['updated_at'] = Time.now.strftime('%d-%m-%Y %I:%M %p')

      save_db(db)
      set_json_response(response, { success: true, message: 'Maklumat pensyarah berjaya dikemaskini!' })

    when '/api/admin/delete_lecturer'
      id = body['id']
      if id.nil?
        return set_json_response(response, { success: false, message: 'ID diperlukan' }, 400)
      end

      idx = db.find_index { |l| l['id'] == id.to_i }
      if idx.nil?
        return set_json_response(response, { success: false, message: 'Pensyarah tidak dijumpai' }, 404)
      end

      db.delete_at(idx)
      save_db(db)
      set_json_response(response, { success: true, message: 'Rekod pensyarah berjaya dipadam!' })

    when '/api/admin/reset_all'
      db.each do |l|
        l['status'] = 'Dalam Kampus'
        l['destination'] = ''
        l['waktu_keluar'] = ''
        l['waktu_kembali'] = ''
        l['updated_at'] = Time.now.strftime('%d-%m-%Y %I:%M %p')
      end

      save_db(db)
      set_json_response(response, { success: true, message: 'Semua status pensyarah berjaya di-reset ke Dalam Kampus!' })

    when '/api/admin/reset_single'
      id = body['id']
      if id.nil?
        return set_json_response(response, { success: false, message: 'ID diperlukan' }, 400)
      end

      idx = db.find_index { |l| l['id'] == id.to_i }
      if idx.nil?
        return set_json_response(response, { success: false, message: 'Pensyarah tidak dijumpai' }, 404)
      end

      db[idx]['status'] = 'Dalam Kampus'
      db[idx]['destination'] = ''
      db[idx]['waktu_keluar'] = ''
      db[idx]['waktu_kembali'] = ''
      db[idx]['updated_at'] = Time.now.strftime('%d-%m-%Y %I:%M %p')

      save_db(db)
      set_json_response(response, { success: true, message: 'Status pensyarah berjaya di-reset!' })

    else
      set_json_response(response, { success: false, message: 'Tindakan pentadbir tidak sah' }, 404)
    end
  end

  def do_OPTIONS(request, response)
    super
  end
end

# --- Main Server Execution ---
def run
  # First trigger seeding
  seed_db

  local_ip = get_local_ip
  
  # Configure WEBrick HTTP Server
  server = WEBrick::HTTPServer.new(
    Port: PORT,
    BindAddress: '0.0.0.0',
    DocumentRoot: File.join(Dir.pwd, 'public'),
    Logger: WEBrick::Log.new($stderr, WEBrick::BasicLog::WARN), # Suppress excessive logs
    AccessLog: [] # Clean stdout output
  )

  # Mount API endpoints
  server.mount '/api/lecturers', LecturersServlet
  server.mount '/api/login', LoginServlet
  server.mount '/api/status', StatusServlet
  
  # Mount Admin API endpoints
  server.mount '/api/admin/login', AdminLoginServlet
  server.mount '/api/admin/lecturers', AdminLecturersServlet
  server.mount '/api/admin/add_lecturer', AdminServlet
  server.mount '/api/admin/update_lecturer', AdminServlet
  server.mount '/api/admin/delete_lecturer', AdminServlet
  server.mount '/api/admin/reset_all', AdminServlet
  server.mount '/api/admin/reset_single', AdminServlet

  puts "\n" + "="*70
  puts "        Sistem Status Pensyarah KKPPS (e-Hadir) Berjaya Dijalankan!"
  puts "="*70
  puts " Akses Pelayar Tempatan:  http://localhost:#{PORT}/index.html"
  puts " Akses Rangkaian Wifi:    http://#{local_ip}:#{PORT}/index.html"
  puts " Hubungkan peranti lain (Pelajar/Staf) ke Wifi yang sama & buka pautan di atas."
  puts "="*70 + "\n"

  # Trap exit signal to close cleanly
  trap('INT') { server.shutdown }
  
  server.start
end

if __FILE__ == $0
  run
end
