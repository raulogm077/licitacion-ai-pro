import os
import json

def find_components():
    components = []
    for root, dirs, files in os.walk('src/components'):
        for file in files:
            if file.endswith('.tsx'):
                components.append(os.path.join(root, file))
    for root, dirs, files in os.walk('src/features'):
        for file in files:
            if file.endswith('.tsx') and 'components' in root:
                components.append(os.path.join(root, file))
    return components

def find_services():
    services = []
    for root, dirs, files in os.walk('src/services'):
        for file in files:
            if file.endswith('.ts'):
                services.append(os.path.join(root, file))
    return services

def find_stores():
    stores = []
    for root, dirs, files in os.walk('src/stores'):
        for file in files:
            if file.endswith('.ts'):
                stores.append(os.path.join(root, file))
    return stores

print("=== Análisis de Arquitectura Frontend ===")
print(f"Total Componentes Reutilizables: {len(find_components())}")
print(f"Total Servicios: {len(find_services())}")
print(f"Total Stores (Zustand): {len(find_stores())}")
