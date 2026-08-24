import { useState } from "react";
import { LocateFixed, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Props = {
  label: string;
  text: string;
  latitude: number | null;
  longitude: number | null;
  onTextChange: (value: string) => void;
  onCoordinatesChange: (latitude: number, longitude: number) => void;
  required?: boolean;
};

export const LocationPicker = ({ label, text, latitude, longitude, onTextChange, onCoordinatesChange, required }: Props) => {
  const [loading, setLoading] = useState(false);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) { toast.error("Location is not supported by this browser"); return; }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        onCoordinatesChange(Number(coords.latitude.toFixed(6)), Number(coords.longitude.toFixed(6)));
        setLoading(false);
        toast.success("Exact location captured");
      },
      () => { setLoading(false); toast.error("Allow location access to capture the exact location"); },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };

  const mapUrl = latitude != null && longitude != null
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.01}%2C${latitude - 0.01}%2C${longitude + 0.01}%2C${latitude + 0.01}&layer=mapnik&marker=${latitude}%2C${longitude}`
    : null;

  return (
    <div className="space-y-2">
      <Label>{label}{required ? " *" : ""}</Label>
      <div className="flex gap-2">
        <Input value={text} onChange={e => onTextChange(e.target.value)} placeholder="County / city / area" />
        <Button type="button" variant="outline" size="icon" onClick={useCurrentLocation} disabled={loading} title="Use current location">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
        </Button>
      </div>
      {latitude != null && longitude != null ? (
        <div className="overflow-hidden rounded-lg border border-primary/20">
          <iframe title="Selected location" src={mapUrl!} className="h-36 w-full" loading="lazy" />
          <p className="flex items-center gap-1 px-2 py-1 text-[10px] text-muted-foreground"><MapPin className="h-3 w-3" />{latitude}, {longitude}</p>
        </div>
      ) : <p className="text-[10px] text-muted-foreground">Use the location button to pin the exact position.</p>}
    </div>
  );
};