import greenfoot.*;  // (World, Actor, GreenfootImage, Greenfoot and MouseInfo)

/**
 * Write a description of class star here.
 * 
 * @author (your name) 
 * @version (a version number or a date)
 */
public class star extends background
{
    /**
     * Act - do whatever the star wants to do. This method is called whenever
     * the 'Act' or 'Run' button gets pressed in the environment.
     */
    boolean r = true;
    
    public void act()
    {
        if(r)
        {
            setLocation(Greenfoot.getRandomNumber(720),Greenfoot.getRandomNumber(500));
            r = false;
        }
        mo();
    }
}
