import re

file_path = "src/features/dashboard/Dashboard.tsx"
with open(file_path, "r") as f:
    content = f.read()

# Add availableSections prop to Sidebar
pattern = r"<Sidebar\s+activeSection=\{activeSection\}\s+onSectionChange=\{setActiveSection\}\s+alertCount=\{alertCount\}\s+/>"
replacement = """<Sidebar
                activeSection={activeSection}
                onSectionChange={setActiveSection}
                alertCount={alertCount}
                availableSections={vm.chapters.map(c => c.id)}
            />"""

content = re.sub(pattern, replacement, content)

# Also handle "plantilla" view in switch
pattern_switch = r"case 'resumen':"
replacement_switch = """case 'plantilla':
                return (
                    <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
                        <div className="max-w-[1100px] mx-auto bg-white rounded-lg shadow-sm border border-slate-200 p-8">
                           <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                               <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                                   <FileText className="w-5 h-5 text-indigo-600" />
                               </div>
                               <div>
                                   <h2 className="text-xl font-bold text-slate-900">Extracción Personalizada</h2>
                                   <p className="text-sm text-slate-500">Datos extraídos mediante la plantilla seleccionada</p>
                               </div>
                           </div>
                           <div className="bg-slate-950 text-slate-50 p-6 rounded-xl font-mono text-sm overflow-x-auto">
                               <pre>{JSON.stringify((vm.result as any).plantilla_personalizada, null, 2)}</pre>
                           </div>
                        </div>
                    </div>
                );
            case 'resumen':"""

content = re.sub(pattern_switch, replacement_switch, content)

with open(file_path, "w") as f:
    f.write(content)
