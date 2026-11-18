import { TestBed } from '@angular/core/testing';
import { TratamientosComponent } from './tratamientos.component';
import { TratamientosService } from '../../services/tratamientos.service';
import { SearchService } from '../../services/search.service';
import { ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

describe('TratamientosComponent - Pruebas de Integración', () => {
  let component: TratamientosComponent;
  let tratamientosService: TratamientosService;

  const getTratamientosSpy = vi.fn(() => of({ success: true, data: [] }));

  const mockTratamientosService = {
    getTratamientos: getTratamientosSpy
  };
  const mockSearchService = {
    indexar: () => of({}),
    buscarModulo: () => of({})
  };

  beforeEach(async () => {
    getTratamientosSpy.mockReset();
    getTratamientosSpy.mockReturnValue(of({ success: true, data: [] }));

    await TestBed.configureTestingModule({
      imports: [TratamientosComponent],
      providers: [
        { provide: TratamientosService, useValue: mockTratamientosService },
        { provide: SearchService, useValue: mockSearchService },
        { provide: ChangeDetectorRef, useValue: { detectChanges: () => {} } },
        { provide: PLATFORM_ID, useValue: 'browser' }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(TratamientosComponent);
    component = fixture.componentInstance;
    tratamientosService = TestBed.inject(TratamientosService);
  });

  // ✅ AUT-06
  it('debe llamar al servicio getTratamientos al inicializar', () => {
    component.ngOnInit();
    expect(getTratamientosSpy).toHaveBeenCalled();
  });

  // ✅ AUT-07 (CORREGIDO)
  it('debe manejar un error del servidor al cargar tratamientos', () => {
    getTratamientosSpy.mockReturnValue(throwError(() => new Error('Error de red')));

    const toastSpy = vi.spyOn(component as any, 'showToast');
    
    component.cargarTratamientos();
    
    expect(component.isLoading).toBe(false);
    expect(component.errorMessage).toContain('Error al cargar los tratamientos');
    expect(toastSpy).toHaveBeenCalledWith('Error al cargar los tratamientos', 'error');
  });
});