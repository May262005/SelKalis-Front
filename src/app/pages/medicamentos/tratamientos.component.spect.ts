import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TratamientosComponent } from './tratamientos.component';
import { TratamientosService } from '../../services/tratamientos.service';
import { SearchService } from '../../services/search.service';
import { ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { of, throwError } from 'rxjs';

describe('TratamientosComponent - Pruebas Unitarias y de Integración', () => {
  let component: TratamientosComponent;
  let fixture: ComponentFixture<TratamientosComponent>;
  let tratamientosService: TratamientosService;

  const getTratamientosSpy = jasmine.createSpy('getTratamientos').and.returnValue(of({ success: true, data: [] }));

  const mockTratamientosService = {
    getTratamientos: getTratamientosSpy
  };
  const mockSearchService = {
    indexar: () => of({}),
    buscarModulo: () => of({})
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TratamientosComponent],
      providers: [
        { provide: TratamientosService, useValue: mockTratamientosService },
        { provide: SearchService, useValue: mockSearchService },
        { provide: ChangeDetectorRef, useValue: { detectChanges: () => {} } },
        { provide: PLATFORM_ID, useValue: 'browser' }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TratamientosComponent);
    component = fixture.componentInstance;
    tratamientosService = TestBed.inject(TratamientosService);
  });

  // ✅ AUT-01: Cálculo de horarios
  it('debe calcular los horarios correctamente dada una frecuencia y hora', () => {
    const horarios = component.calcularHorarios('Cada 8 horas', '08:00');
    expect(horarios.length).toBe(3);
    expect(horarios).toEqual(['08:00', '16:00', '00:00']);
  });

  // ✅ AUT-02: Hora inválida
  it('debe retornar un arreglo vacío si la hora es inválida', () => {
    const horarios = component.calcularHorarios('Cada 8 horas', '');
    expect(horarios.length).toBe(0);
  });

  // ✅ AUT-03: Fecha pasada
  it('debe detectar si una fecha es pasada correctamente', () => {
    const fechaPasada = '2020-01-01';
    const esPasada = (component as any)['esFechaPasada'](fechaPasada);
    expect(esPasada).toBeTrue();
  });

  // ✅ AUT-04: Paginación
  it('debe dividir los tratamientos en páginas de 10', () => {
    component.tratamientosFiltrados = new Array(15).fill({ id: '1', nombre: 'Test' });
    component.paginaActual = 1;
    
    const paginados = component.tratamientosPaginados;
    expect(paginados.length).toBe(10);
  });

  // ✅ AUT-05: Formato de hora 12h
  it('debe formatear la hora a 12h correctamente y manejar errores', () => {
    expect(component.formatearHora12('14:30')).toBe('2:30 PM');
    expect(component.formatearHora12('00:00')).toBe('12:00 AM');
    expect(component.formatearHora12('')).toBe('');
  });

  // ✅ AUT-06 (Integración 1): Llamada al servicio al iniciar
  it('debe llamar al servicio getTratamientos al inicializar', () => {
    component.ngOnInit();
    expect(getTratamientosSpy).toHaveBeenCalled();
  });

  // ✅ AUT-07 (Integración 2): Manejo de error del servidor
  it('debe manejar un error del servidor al cargar tratamientos', () => {
    getTratamientosSpy.and.returnValue(throwError(() => new Error('Error de red')));
    const toastSpy = spyOn(component as any, 'showToast');
    
    component.cargarTratamientos();
    
    expect(component.isLoading).toBeFalse();
    expect(component.errorMessage).toContain('Error al cargar los tratamientos');
    expect(toastSpy).toHaveBeenCalledWith('Error al cargar los tratamientos', 'error');
  });
});