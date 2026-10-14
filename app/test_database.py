from database import get_connection


try:
    connection = get_connection()

    print("Koneksi PostgreSQL berhasil!")

    connection.close()

except Exception as e:
    print("Koneksi PostgreSQL gagal.")
    print("Error:", e)