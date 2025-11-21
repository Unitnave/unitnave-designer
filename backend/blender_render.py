"""
Script de Blender para generar renders profesionales de naves industriales
Se ejecuta en modo headless desde el backend Python
"""

import bpy
import json
import sys
import math
from mathutils import Vector

def clear_scene():
    """Limpiar escena de Blender"""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    
    # Limpiar materiales, texturas, etc.
    for material in bpy.data.materials:
        bpy.data.materials.remove(material)

def create_warehouse_shell(length, width, height):
    """Crear estructura principal de la nave"""
    
    # SUELO
    bpy.ops.mesh.primitive_plane_add(size=1, location=(length/2, width/2, 0))
    floor = bpy.context.active_object
    floor.name = "Floor"
    floor.scale = (length/2, width/2, 1)
    
    # Material suelo - hormigón pulido
    floor_mat = bpy.data.materials.new(name="Concrete_Floor")
    floor_mat.use_nodes = True
    nodes = floor_mat.node_tree.nodes
    nodes.clear()
    
    # Nodo Principled BSDF
    bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = (0.6, 0.6, 0.6, 1)
    bsdf.inputs['Roughness'].default_value = 0.3
    bsdf.inputs['Metallic'].default_value = 0.0
    
    output = nodes.new(type='ShaderNodeOutputMaterial')
    floor_mat.node_tree.links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    
    floor.data.materials.append(floor_mat)
    
    # PAREDES
    wall_thickness = 0.3
    wall_height = height
    
    # Pared trasera
    bpy.ops.mesh.primitive_cube_add(size=1, location=(length/2, 0, wall_height/2))
    back_wall = bpy.context.active_object
    back_wall.name = "Wall_Back"
    back_wall.scale = (length/2, wall_thickness/2, wall_height/2)
    
    # Pared frontal
    bpy.ops.mesh.primitive_cube_add(size=1, location=(length/2, width, wall_height/2))
    front_wall = bpy.context.active_object
    front_wall.name = "Wall_Front"
    front_wall.scale = (length/2, wall_thickness/2, wall_height/2)
    
    # Pared izquierda
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, width/2, wall_height/2))
    left_wall = bpy.context.active_object
    left_wall.name = "Wall_Left"
    left_wall.scale = (wall_thickness/2, width/2, wall_height/2)
    
    # Pared derecha
    bpy.ops.mesh.primitive_cube_add(size=1, location=(length, width/2, wall_height/2))
    right_wall = bpy.context.active_object
    right_wall.name = "Wall_Right"
    right_wall.scale = (wall_thickness/2, width/2, wall_height/2)
    
    # Material paredes - chapa metálica
    wall_mat = bpy.data.materials.new(name="Metal_Wall")
    wall_mat.use_nodes = True
    nodes = wall_mat.node_tree.nodes
    nodes.clear()
    
    bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = (0.8, 0.8, 0.85, 1)
    bsdf.inputs['Roughness'].default_value = 0.4
    bsdf.inputs['Metallic'].default_value = 0.9
    
    output = nodes.new(type='ShaderNodeOutputMaterial')
    wall_mat.node_tree.links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    
    for wall in [back_wall, front_wall, left_wall, right_wall]:
        wall.data.materials.append(wall_mat)
    
    # TECHO - estructura metálica
    bpy.ops.mesh.primitive_plane_add(size=1, location=(length/2, width/2, height))
    roof = bpy.context.active_object
    roof.name = "Roof"
    roof.scale = (length/2, width/2, 1)
    
    roof_mat = bpy.data.materials.new(name="Metal_Roof")
    roof_mat.use_nodes = True
    nodes = roof_mat.node_tree.nodes
    nodes.clear()
    
    bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = (0.7, 0.7, 0.75, 1)
    bsdf.inputs['Roughness'].default_value = 0.5
    bsdf.inputs['Metallic'].default_value = 0.8
    
    output = nodes.new(type='ShaderNodeOutputMaterial')
    roof_mat.node_tree.links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    
    roof.data.materials.append(roof_mat)

def create_shelf(x, y, z, shelf_length, shelf_height, shelf_depth):
    """Crear estantería industrial"""
    
    # Material estantería - acero industrial (crear primero)
    shelf_mat = bpy.data.materials.new(name=f"Industrial_Steel_{x}_{y}")
    shelf_mat.use_nodes = True
    nodes = shelf_mat.node_tree.nodes
    nodes.clear()
    
    bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = (0.9, 0.5, 0.1, 1)  # Naranja típico estanterías
    bsdf.inputs['Roughness'].default_value = 0.6
    bsdf.inputs['Metallic'].default_value = 0.95
    
    output = nodes.new(type='ShaderNodeOutputMaterial')
    shelf_mat.node_tree.links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    
    # Estructura simplificada de estantería
    # Postes verticales
    post_size = 0.1
    
    for i in [0, shelf_length]:
        for j in [0, shelf_depth]:
            bpy.ops.mesh.primitive_cube_add(
                size=1, 
                location=(x + i, y + j, z + shelf_height/2)
            )
            post = bpy.context.active_object
            post.scale = (post_size/2, post_size/2, shelf_height/2)
            # ✅ CORRECCIÓN: Asignar material a los postes
            post.data.materials.append(shelf_mat)
    
    # Niveles horizontales
    levels = 4
    for level in range(levels + 1):
        level_height = z + (shelf_height / levels) * level
        bpy.ops.mesh.primitive_cube_add(
            size=1,
            location=(x + shelf_length/2, y + shelf_depth/2, level_height)
        )
        shelf_level = bpy.context.active_object
        shelf_level.scale = (shelf_length/2, shelf_depth/2, 0.05)
        # ✅ CORRECCIÓN: Asignar material a los niveles
        shelf_level.data.materials.append(shelf_mat)

def create_office(x, y, z, office_length, office_width, office_height):
    """Crear módulo de oficinas"""
    
    bpy.ops.mesh.primitive_cube_add(
        size=1,
        location=(x + office_length/2, y + office_width/2, z + office_height/2)
    )
    office = bpy.context.active_object
    office.name = "Office"
    office.scale = (office_length/2, office_width/2, office_height/2)
    
    # Material oficina - cristal y aluminio
    office_mat = bpy.data.materials.new(name="Glass_Office")
    office_mat.use_nodes = True
    nodes = office_mat.node_tree.nodes
    nodes.clear()
    
    bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = (0.7, 0.8, 0.9, 1)
    bsdf.inputs['Roughness'].default_value = 0.1
    bsdf.inputs['Transmission'].default_value = 0.9  # Transparencia
    
    output = nodes.new(type='ShaderNodeOutputMaterial')
    office_mat.node_tree.links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    
    office.data.materials.append(office_mat)

def create_loading_dock(x, y, z, dock_width):
    """Crear muelle de carga"""
    
    bpy.ops.mesh.primitive_cube_add(
        size=1,
        location=(x, y + 1.5, z + 0.6)
    )
    dock = bpy.context.active_object
    dock.name = "Dock"
    dock.scale = (dock_width/2, 1.5, 0.6)
    
    # Material muelle - hormigón
    dock_mat = bpy.data.materials.new(name="Dock_Concrete")
    dock_mat.use_nodes = True
    nodes = dock_mat.node_tree.nodes
    nodes.clear()
    
    bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = (0.5, 0.5, 0.5, 1)
    bsdf.inputs['Roughness'].default_value = 0.8
    
    output = nodes.new(type='ShaderNodeOutputMaterial')
    dock_mat.node_tree.links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    
    dock.data.materials.append(dock_mat)

def setup_lighting(warehouse_length, warehouse_width, warehouse_height):
    """Configurar iluminación profesional"""
    
    # Luz principal - sol exterior
    bpy.ops.object.light_add(type='SUN', location=(0, 0, warehouse_height + 10))
    sun = bpy.context.active_object
    sun.data.energy = 3.0
    sun.rotation_euler = (math.radians(60), 0, math.radians(45))
    
    # Luces industriales LED en techo (array)
    num_lights_x = int(warehouse_length / 10)
    num_lights_y = int(warehouse_width / 10)
    
    for i in range(num_lights_x):
        for j in range(num_lights_y):
            x_pos = (i + 1) * (warehouse_length / (num_lights_x + 1))
            y_pos = (j + 1) * (warehouse_width / (num_lights_y + 1))
            
            bpy.ops.object.light_add(
                type='AREA',
                location=(x_pos, y_pos, warehouse_height - 0.5)
            )
            light = bpy.context.active_object
            light.data.energy = 50
            light.data.size = 2.0
            light.data.color = (1.0, 0.95, 0.9)  # Blanco cálido

def setup_camera(warehouse_length, warehouse_width, warehouse_height):
    """Configurar cámara cinematográfica"""
    
    # Posición de cámara isométrica
    cam_distance = max(warehouse_length, warehouse_width) * 1.5
    
    bpy.ops.object.camera_add(
        location=(
            warehouse_length + cam_distance * 0.6,
            -cam_distance * 0.4,
            warehouse_height + cam_distance * 0.5
        )
    )
    camera = bpy.context.active_object
    camera.name = "Camera_Main"
    
    # Apuntar al centro de la nave
    look_at = Vector((warehouse_length/2, warehouse_width/2, warehouse_height/2))
    direction = look_at - camera.location
    camera.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    
    # Configurar como cámara activa
    bpy.context.scene.camera = camera
    
    # Configuración de cámara
    camera.data.lens = 35  # mm
    camera.data.sensor_width = 36

def setup_render_settings(output_path, resolution_x=1920, resolution_y=1080):
    """Configurar opciones de renderizado Cycles"""
    
    scene = bpy.context.scene
    
    # Motor Cycles (fotorealista)
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 128  # Calidad media-alta (ajustar según tiempo)
    scene.cycles.use_denoising = True
    
    # Resolución
    scene.render.resolution_x = resolution_x
    scene.render.resolution_y = resolution_y
    scene.render.resolution_percentage = 100
    
    # Output
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = output_path
    
    # Iluminación global
    scene.world.use_nodes = True
    world_nodes = scene.world.node_tree.nodes
    world_nodes.clear()
    
    background = world_nodes.new(type='ShaderNodeBackground')
    background.inputs['Color'].default_value = (0.5, 0.6, 0.7, 1)  # Cielo azul claro
    background.inputs['Strength'].default_value = 0.3
    
    output = world_nodes.new(type='ShaderNodeOutputWorld')
    scene.world.node_tree.links.new(background.outputs['Background'], output.inputs['Surface'])

def generate_render(design_json, output_path):
    """
    Función principal - generar render desde datos JSON
    
    Args:
        design_json: str - JSON con diseño de nave
        output_path: str - Ruta donde guardar render
    """
    
    try:
        # Parsear diseño
        design = json.loads(design_json)
        
        # Validar estructura básica
        if 'dimensions' not in design:
            raise ValueError("Diseño debe contener 'dimensions'")
        if 'elements' not in design:
            design['elements'] = []
        
        # Limpiar escena
        clear_scene()
        
        # Dimensiones de nave
        length = design['dimensions']['length']
        width = design['dimensions']['width']
        height = design['dimensions']['height']
        
        # Validar dimensiones
        if length <= 0 or width <= 0 or height <= 0:
            raise ValueError(f"Dimensiones inválidas: {length}x{width}x{height}")
        
        # Crear estructura
        create_warehouse_shell(length, width, height)
        
        # Crear elementos
        for element in design['elements']:
            try:
                elem_type = element['type']
                pos = element['position']
                dims = element['dimensions']
                
                if elem_type == 'shelf':
                    create_shelf(
                        pos['x'], pos['y'], pos['z'],
                        dims['length'], dims['height'], dims.get('depth', 1.1)
                    )
                
                elif elem_type == 'office':
                    create_office(
                        pos['x'], pos['y'], pos['z'],
                        dims['length'], dims['width'], dims.get('height', 3.5)
                    )
                
                elif elem_type == 'dock':
                    create_loading_dock(
                        pos['x'], pos['y'], pos['z'],
                        dims.get('width', 3.0)
                    )
            except Exception as e:
                print(f"Warning: Error creando elemento {element.get('id', 'unknown')}: {str(e)}")
                # Continuar con otros elementos
        
        # Iluminación y cámara
        setup_lighting(length, width, height)
        setup_camera(length, width, height)
        
        # Configurar render
        setup_render_settings(output_path)
        
        # RENDERIZAR
        bpy.ops.render.render(write_still=True)
        
        print(f"✅ Render completado: {output_path}")
        return True
        
    except json.JSONDecodeError as e:
        print(f"❌ Error: JSON inválido - {str(e)}")
        return False
    except ValueError as e:
        print(f"❌ Error: Validación fallida - {str(e)}")
        return False
    except Exception as e:
        print(f"❌ Error inesperado durante render: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    # Ejecutar desde línea de comandos:
    # blender --background --python blender_render.py -- '{"design_json": "...", "output": "..."}' 
    
    if "--" in sys.argv:
        args_index = sys.argv.index("--") + 1
        if args_index < len(sys.argv):
            args = json.loads(sys.argv[args_index])
            generate_render(args['design_json'], args['output'])
