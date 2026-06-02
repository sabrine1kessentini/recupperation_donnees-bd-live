import json
import re

def decimal_to_hex4(n):
    return f"{n:04X}"

def parse_devices_md(filepath):
    devices = {}
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    lines = content.split('\n')
    current_nom = None
    current_unicast = None
    
    for line in lines:
        nom_match = re.match(r'Nom\s*:\s*(.+)', line)
        unicast_match = re.match(r'Unicast\s*:\s*([0-9A-Fa-f]+)', line)
        
        if nom_match:
            current_nom = nom_match.group(1).strip()
        if unicast_match:
            current_unicast = unicast_match.group(1).upper()
        
        if current_nom and current_unicast:
            devices[current_unicast] = current_nom
            current_nom = None
            current_unicast = None
    
    return devices

def main():
    with open('recupp_donnees/happy-main/data/mapping_final.json', 'r', encoding='utf-8') as f:
        mapping_data = json.load(f)
    
    devices = parse_devices_md('devices_list.md')
    
    print(f"Loaded {len(devices)} devices from devices_list.md")
    
    updated_count = 0
    for entry in mapping_data:
        waveon = entry.get('waveon', {})
        
        for key in ['unicast_temperature', 'unicast_humidity', 'unicast_occupancy', 
                    'unicast_luminosity', 'unicast_energy', 'unicast_flow']:
            value = waveon.get(key)
            if value is not None:
                hex_value = decimal_to_hex4(value)
                if hex_value in devices:
                    entry['waveon_room_name'] = devices[hex_value]
                    updated_count += 1
                    break
    
    with open('mapping_final_updated.json', 'w', encoding='utf-8') as f:
        json.dump(mapping_data, f, indent=2, ensure_ascii=False)
    
    print(f"Updated {updated_count} entries with waveon_room_name")
    print("Output written to mapping_final_updated.json")

if __name__ == '__main__':
    main()