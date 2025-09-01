import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Download, Image, Edit, Save, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { processImageForUpload } from '@/lib/image-utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { dbOps } from '@/lib/database';
import { jsPDF } from 'jspdf';
import type { ExerciseGlossary } from '@shared/schema';

export function ExerciseGlossaryManager() {
  const [exercises, setExercises] = useState<ExerciseGlossary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentExercise, setCurrentExercise] = useState<Partial<ExerciseGlossary>>({
    name: '',
    description: '',
    images: []
  });
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carica tutti gli esercizi dal database
  const loadExercises = async () => {
    setIsLoading(true);
    try {
      const data = await dbOps.getAllExerciseGlossary();
      setExercises(data);
    } catch (error) {
      console.error('Errore nel caricamento degli esercizi:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile caricare il glossario esercizi',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadExercises();
  }, []);

  const handleOpenDialog = (exercise?: ExerciseGlossary) => {
    if (exercise) {
      setCurrentExercise(exercise);
      setIsEditing(true);
    } else {
      setCurrentExercise({
        name: '',
        description: '',
        images: []
      });
      setIsEditing(false);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setCurrentExercise({
      name: '',
      description: '',
      images: []
    });
  };

  const handleImageUpload = async (file: File) => {
    try {
      const imageBase64 = await processImageForUpload(file, 800, 600);
      setCurrentExercise(prev => ({
        ...prev,
        images: [...(prev.images || []), imageBase64]
      }));
      
      toast({
        title: 'Immagine caricata',
        description: 'L\'immagine è stata aggiunta all\'esercizio'
      });
    } catch (error) {
      toast({
        title: 'Errore',
        description: error instanceof Error ? error.message : 'Impossibile caricare l\'immagine',
        variant: 'destructive'
      });
    }
  };

  const handleRemoveImage = (index: number) => {
    setCurrentExercise(prev => ({
      ...prev,
      images: (prev.images || []).filter((_, i) => i !== index)
    }));
  };

  const handleSaveExercise = async () => {
    if (!currentExercise.name) {
      toast({
        title: 'Errore',
        description: 'Il nome dell\'esercizio è obbligatorio',
        variant: 'destructive'
      });
      return;
    }

    try {
      if (isEditing && currentExercise.id) {
        // Aggiorna esercizio esistente
        await dbOps.updateExerciseGlossary(currentExercise.id, currentExercise as ExerciseGlossary);
        toast({
          title: 'Esercizio aggiornato',
          description: `L'esercizio "${currentExercise.name}" è stato aggiornato`
        });
      } else {
        // Crea nuovo esercizio
        const newExercise: ExerciseGlossary = {
          ...currentExercise as ExerciseGlossary,
          id: crypto.randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date()
        };
        await dbOps.createExerciseGlossary(newExercise);
        toast({
          title: 'Esercizio creato',
          description: `L'esercizio "${newExercise.name}" è stato creato`
        });
      }
      
      handleCloseDialog();
      loadExercises();
    } catch (error) {
      console.error('Errore nel salvataggio dell\'esercizio:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile salvare l\'esercizio',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteExercise = async (id: string) => {
    if (window.confirm('Sei sicuro di voler eliminare questo esercizio?')) {
      try {
        await dbOps.deleteExerciseGlossary(id);
        toast({
          title: 'Esercizio eliminato',
          description: 'L\'esercizio è stato eliminato con successo'
        });
        loadExercises();
      } catch (error) {
        console.error('Errore nell\'eliminazione dell\'esercizio:', error);
        toast({
          title: 'Errore',
          description: 'Impossibile eliminare l\'esercizio',
          variant: 'destructive'
        });
      }
    }
  };

  const generatePDF = async () => {
    if (exercises.length === 0) {
      toast({
        title: 'Nessun esercizio',
        description: 'Non ci sono esercizi nel glossario da esportare',
        variant: 'destructive'
      });
      return;
    }

    try {
      const doc = new jsPDF();
      let yPos = 20;
      
      // Titolo
      doc.setFontSize(22);
      doc.setTextColor(33, 99, 232); // Blu
      doc.text('GLOSSARIO ESERCIZI', 105, yPos, { align: 'center' });
      yPos += 15;

      // Sottotitolo
      const coachProfile = await dbOps.getCoachProfile();
      if (coachProfile) {
        doc.setFontSize(12);
        doc.setTextColor(100, 100, 100); // Grigio
        doc.text(coachProfile.name, 105, yPos, { align: 'center' });
        yPos += 15;
      }

      // Esercizi
      for (const exercise of exercises) {
        // Verifica se c'è abbastanza spazio nella pagina
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }

        // Nome esercizio
        doc.setFontSize(16);
        doc.setTextColor(0, 0, 0); // Nero
        doc.text(exercise.name, 20, yPos);
        yPos += 10;

        // Descrizione
        if (exercise.description) {
          doc.setFontSize(10);
          doc.setTextColor(80, 80, 80); // Grigio scuro
          
          // Dividi la descrizione in righe
          const splitDescription = doc.splitTextToSize(exercise.description, 170);
          doc.text(splitDescription, 20, yPos);
          yPos += splitDescription.length * 5 + 5;
        }

        // Immagini
        if (exercise.images && exercise.images.length > 0) {
          const imgWidth = 50;
          const imgHeight = 50;
          let xPos = 20;
          
          for (const imgSrc of exercise.images) {
            // Verifica se c'è abbastanza spazio nella riga
            if (xPos + imgWidth > 190) {
              xPos = 20;
              yPos += imgHeight + 10;
            }
            
            // Verifica se c'è abbastanza spazio nella pagina
            if (yPos + imgHeight > 280) {
              doc.addPage();
              yPos = 20;
              xPos = 20;
            }
            
            try {
              doc.addImage(imgSrc, 'JPEG', xPos, yPos, imgWidth, imgHeight);
              xPos += imgWidth + 10;
            } catch (error) {
              console.error('Errore nell\'aggiunta dell\'immagine al PDF:', error);
            }
          }
          
          yPos += imgHeight + 15;
        } else {
          yPos += 10;
        }

        // Linea separatrice
        doc.setDrawColor(200, 200, 200); // Grigio chiaro
        doc.line(20, yPos - 5, 190, yPos - 5);
        yPos += 10;
      }

      // Salva il PDF
      doc.save('Glossario_Esercizi.pdf');
      
      toast({
        title: 'PDF generato',
        description: 'Il glossario esercizi è stato esportato in PDF'
      });
    } catch (error) {
      console.error('Errore nella generazione del PDF:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile generare il PDF',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Glossario Esercizi
        </h2>
        <div className="flex space-x-2">
          <Button
            onClick={generatePDF}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Download size={16} />
            Esporta PDF
          </Button>
          <Button
            onClick={() => handleOpenDialog()}
            className="bg-gradient-primary hover:opacity-90 transition-opacity"
          >
            <Plus className="mr-2" size={16} />
            Nuovo Esercizio
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <p>Caricamento...</p>
        </div>
      ) : exercises.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Nessun esercizio nel glossario
          </p>
          <Button
            onClick={() => handleOpenDialog()}
            variant="outline"
            className="bg-white dark:bg-gray-800"
          >
            <Plus className="mr-2" size={16} />
            Aggiungi il primo esercizio
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {exercises.map((exercise) => (
            <Card key={exercise.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-lg flex justify-between items-center">
                  <span className="truncate">{exercise.name}</span>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-blue-500"
                      onClick={() => handleOpenDialog(exercise)}
                    >
                      <Edit size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-red-500"
                      onClick={() => handleDeleteExercise(exercise.id)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                {exercise.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                    {exercise.description}
                  </p>
                )}
                {exercise.images && exercise.images.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {exercise.images.slice(0, 3).map((img, index) => (
                      <div key={index} className="relative w-16 h-16 rounded overflow-hidden bg-gray-100 dark:bg-gray-800">
                        <img
                          src={img}
                          alt={`${exercise.name} - immagine ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                    {exercise.images.length > 3 && (
                      <div className="w-16 h-16 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded">
                        <span className="text-sm text-gray-500 dark:text-gray-400">+{exercise.images.length - 3}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog per creare/modificare esercizio */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Modifica Esercizio' : 'Nuovo Esercizio'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome Esercizio *</label>
              <Input
                value={currentExercise.name || ''}
                onChange={(e) => setCurrentExercise({ ...currentExercise, name: e.target.value })}
                placeholder="Nome dell'esercizio"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Descrizione</label>
              <Textarea
                value={currentExercise.description || ''}
                onChange={(e) => setCurrentExercise({ ...currentExercise, description: e.target.value })}
                placeholder="Descrizione dell'esercizio"
                rows={4}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Immagini</label>
              
              {/* Immagini caricate */}
              {currentExercise.images && currentExercise.images.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {currentExercise.images.map((img, index) => (
                    <div key={index} className="relative rounded overflow-hidden bg-gray-100 dark:bg-gray-800 aspect-square">
                      <img
                        src={img}
                        alt={`Immagine ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        className="absolute top-1 right-1 h-6 w-6 p-0 rounded-full"
                        onClick={() => handleRemoveImage(index)}
                      >
                        <X size={12} />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-8 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg mb-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                    Nessuna immagine caricata
                  </p>
                </div>
              )}
              
              {/* Pulsante carica immagine */}
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2 flex items-center justify-center gap-2"
              >
                <Image size={16} />
                Aggiungi Immagine
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleImageUpload(file);
                    e.target.value = ''; // Reset input
                  }
                }}
                className="hidden"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>Annulla</Button>
            <Button onClick={handleSaveExercise} className="bg-gradient-primary hover:opacity-90 transition-opacity">
              <Save className="mr-2" size={16} />
              {isEditing ? 'Aggiorna' : 'Salva'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Dialog per l'anteprima del PDF */}
      <Dialog open={previewDialogOpen} onOpenChange={(open) => {
        setPreviewDialogOpen(open);
        if (!open && pdfPreviewUrl) {
          // Rilascia l'URL dell'oggetto quando il dialog viene chiuso
          URL.revokeObjectURL(pdfPreviewUrl);
          setPdfPreviewUrl('');
        }
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Anteprima Glossario Esercizi</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 h-full overflow-hidden">
            {pdfPreviewUrl && (
              <iframe 
                src={pdfPreviewUrl} 
                className="w-full h-[calc(90vh-120px)]" 
                title="Anteprima PDF"
              />
            )}
          </div>
          
          <DialogFooter>
            <Button 
              onClick={() => {
                if (pdfPreviewUrl) {
                  // Crea un link temporaneo per il download
                  const a = document.createElement('a');
                  a.href = pdfPreviewUrl;
                  a.download = 'Glossario_Esercizi.pdf';
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }
              }} 
              className="bg-gradient-primary hover:opacity-90 transition-opacity"
            >
              <Download className="mr-2" size={16} />
              Scarica PDF
            </Button>
            <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
              Chiudi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}